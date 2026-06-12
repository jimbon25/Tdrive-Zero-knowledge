import typer
import asyncio
from rich.console import Console
from rich.status import Status
from core.session import SessionManager
from core.db.session import DatabaseSession
from core.client import TDriveClient

console = Console()

def handle_doctor():
    """Check the health of TDrive components."""
    sm = SessionManager()
    
    console.print("[bold]TDrive Health Check[/bold]\n")
    
    # 1. Config Check
    if sm.config_file.exists():
        console.print("  [green]✔[/green] Configuration file exists")
    else:
        console.print("  [red]✘[/red] Configuration file missing")
        return

    config = sm.load_config()
    
    # 2. Database Check
    db_path = sm.config_dir / "tdrive.db"
    if db_path.exists():
        console.print("  [green]✔[/green] Database file found")
    else:
        console.print("  [yellow]![/yellow] Database file missing (normal if no uploads yet)")

    # 3. Telegram Session & Connection
    session_path = sm.config_dir / "tdrive.session"
    if session_path.exists():
        console.print("  [green]✔[/green] Telegram session file found")
        
        async def test_conn():
            tg = TDriveClient(session_path, config["api_id"], config["api_hash"])
            try:
                with Status("Testing Telegram connection...", console=console):
                    await tg.connect()
                    if await tg.is_user_authorized():
                        console.print("  [green]✔[/green] Telegram: Connected and Authorized")
                        
                        if await tg.validate_channel(config["channel_id"]):
                            console.print("  [green]✔[/green] Telegram: Storage Channel accessible")
                        else:
                            console.print("  [red]✘[/red] Telegram: Storage Channel NOT accessible")
                    else:
                        console.print("  [red]✘[/red] Telegram: Connected but NOT authorized (run 'tdrive login')")
                    await tg.disconnect()
            except Exception as e:
                console.print(f"  [red]✘[/red] Telegram: Connection failed ({str(e)})")
        
        asyncio.run(test_conn())
    else:
        console.print("  [red]✘[/red] Telegram session missing (run 'tdrive login')")

    console.print("\n[bold green]Diagnostic complete.[/bold green]")
