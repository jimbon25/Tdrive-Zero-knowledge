import asyncio
import typer
from rich.console import Console
from core.session import SessionManager
from core.bootstrap import BootstrapService
from telethon import TelegramClient

console = Console()

def handle_login():
    """Log in to Telegram and create a session."""
    service = BootstrapService()
    status = service.get_status()
    
    if not status["is_initialized"]:
        console.print("[red]Error: TDrive not initialized. Run 'tdrive init' first.[/red]")
        raise typer.Exit(1)

    sm = SessionManager()
    config = sm.load_config()
    session_path = sm.config_dir / "tdrive.session"
    
    client = TelegramClient(str(session_path), config["api_id"], config["api_hash"])
    
    async def do_login():
        console.print("[bold cyan]Starting Telegram Login...[/bold cyan]")
        await client.start()
        console.print("[bold green]Successfully logged in![/bold green]")
        await client.disconnect()

    asyncio.run(do_login())
