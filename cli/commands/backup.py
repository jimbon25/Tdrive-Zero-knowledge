import asyncio
import typer
from pathlib import Path
from rich.console import Console
from core.session import SessionManager
from core.recovery import BackupEngine

app = typer.Typer(help="Manage encrypted system backups.", no_args_is_help=True)
console = Console()

@app.command(name="create")
def create_backup(output: str = typer.Option("tdrive_backup.zip", "--output", "-o", help="Backup file path")):
    """[bold green]Backup[/bold green] TDrive configuration and database."""
    sm = SessionManager()
    password = typer.prompt("Enter password to protect backup", hide_input=True)
    
    engine = BackupEngine(sm.config_dir)
    out_path = Path(output)
    
    console.print(f"[bold cyan]Creating backup...[/bold cyan]")
    engine.create_backup(out_path, password)
    
    console.print(f"[bold green]Success![/bold green] Backup saved to {out_path.absolute()}")

@app.command(name="restore")
def restore_backup(input_path: str = typer.Argument(..., help="Path to backup zip")):
    """[bold red]Restore[/bold red] TDrive from a backup zip."""
    sm = SessionManager()
    path = Path(input_path)
    
    if not path.exists():
        console.print(f"[red]Error: Backup file {path} not found.[/red]")
        raise typer.Exit(1)
        
    engine = BackupEngine(sm.config_dir)
    
    console.print(f"[bold yellow]Restoring from {path}...[/bold yellow]")
    if engine.restore_backup(path):
        console.print("[bold green]Restore complete![/bold green] You may need to run 'tdrive login' again.")
    else:
        console.print("[red]Restore failed.[/red]")
