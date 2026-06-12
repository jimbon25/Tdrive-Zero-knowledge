import typer
from rich.console import Console
from core.bootstrap import BootstrapService
from core.session import SessionManager

console = Console()

def handle_init():
    """Initialize TDrive configuration and directory."""
    service = BootstrapService()
    status = service.get_status()
    
    if status["is_initialized"]:
        console.print("[yellow]TDrive is already initialized.[/yellow]")
        return

    console.print("[bold green]Initializing TDrive...[/bold green]")
    
    api_id = typer.prompt("Enter Telegram API ID", type=int)
    api_hash = typer.prompt("Enter Telegram API Hash")
    channel_id = typer.prompt("Enter Private Channel ID (e.g. -100...)", type=int)
    
    password = typer.prompt("Set a Master Password (used for encryption)", hide_input=True, confirmation_prompt=True)
    
    try:
        service.initialize_config(api_id, api_hash, channel_id, password)
        console.print(f"[bold green]Success![/bold green] Config saved to {status['config_path']}")
        console.print("[dim]Note: Keep your master password safe; it is never stored.[/dim]")
    except Exception as e:
        console.print(f"[red]Error during initialization: {str(e)}[/red]")
        raise typer.Exit(1)
