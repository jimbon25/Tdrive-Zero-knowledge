import asyncio
import typer
from rich.console import Console
from rich.panel import Panel
from core.session import SessionManager
from core.db.session import DatabaseSession
from core.client import TDriveClient
from core.recovery import RecoveryEngine

app = typer.Typer(help="System maintenance and recovery tools.", no_args_is_help=True)
console = Console()

@app.command(name="rebuild")
def rebuild_index(full: bool = typer.Option(False, "--full", help="Perform a full scan of channel history")):
    """[bold yellow]Rebuild[/bold yellow] the local database from Telegram metadata."""
    sm = SessionManager()
    config = sm.load_config()
    password = typer.prompt("Enter Master Password", hide_input=True)
    
    async def run():
        tg = TDriveClient(sm.config_dir / "tdrive.session", config["api_id"], config["api_hash"])
        await tg.connect()
        
        db_path = sm.config_dir / "tdrive.db"
        db_session = DatabaseSession(str(db_path))
        db_session.create_tables()
        
        engine = RecoveryEngine(db_session, tg, config["channel_id"], master_password=password)
        
        console.print(f"[bold cyan]Starting {'full' if full else 'incremental'} index rebuild...[/bold cyan]")
        stats = await engine.rebuild_index(full=full)
        
        console.print(Panel(
            f"Scanned: {stats['scanned']}\n"
            f"Recovered Chunks: {stats['recovered_chunks']}\n"
            f"Errors: {stats['errors']}",
            title="Rebuild Complete",
            border_style="green"
        ))
        
        await tg.disconnect()

    asyncio.run(run())

@app.command(name="audit")
def audit_integrity():
    """[bold blue]Audit[/bold blue] the integrity of all files in TDrive."""
    sm = SessionManager()
    config = sm.load_config()
    
    async def run():
        tg = TDriveClient(sm.config_dir / "tdrive.session", config["api_id"], config["api_hash"])
        await tg.connect()
        
        db_path = sm.config_dir / "tdrive.db"
        db_session = DatabaseSession(str(db_path))
        
        engine = RecoveryEngine(db_session, tg, config["channel_id"])
        
        console.print("[bold cyan]Auditing TDrive integrity...[/bold cyan]")
        report = await engine.audit_integrity()
        
        console.print(Panel(
            f"Total Files: {report['total_files']}\n"
            f"Missing Chunks: {report['missing_chunks']}",
            title="Audit Result",
            border_style="yellow" if report["missing_chunks"] > 0 else "green"
        ))
        
        await tg.disconnect()

    asyncio.run(run())

@app.command(name="cleanup")
def cleanup_system():
    """[bold red]Clean[/bold red] orphaned chunks from Telegram and local storage."""
    sm = SessionManager()
    config = sm.load_config()
    password = typer.prompt("Enter Master Password", hide_input=True)
    
    async def run():
        tg = TDriveClient(sm.config_dir / "tdrive.session", config["api_id"], config["api_hash"])
        await tg.connect()
        
        db_path = sm.config_dir / "tdrive.db"
        db_session = DatabaseSession(str(db_path))
        
        engine = RecoveryEngine(db_session, tg, config["channel_id"], master_password=password)
        
        console.print("[bold cyan]Cleaning orphaned chunks...[/bold cyan]")
        deleted = await engine.cleanup_orphans()
        
        console.print(f"[bold green]Success![/bold green] Deleted {deleted} orphaned messages.")
        await tg.disconnect()

    asyncio.run(run())
