import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from core.manager import TDriveManager
from core.session import SessionManager
from core.client import TDriveClient
from core.db.session import DatabaseSession

console = Console()

async def handle_upload(path_str: str, virtual_path: str):
    sm = SessionManager()
    config = sm.load_config()
    if not config:
        console.print("[red]Error: TDrive not initialized. Run 'tdrive init' first.[/red]")
        return

    password = typer.prompt("Enter Master Password", hide_input=True)
    
    db_path = sm.config_dir / "tdrive.db"
    db_session = DatabaseSession(str(db_path))
    db_session.create_tables()
    
    tg_client = TDriveClient(
        sm.config_dir / "tdrive.session", 
        config["api_id"], 
        config["api_hash"]
    )
    
    await tg_client.connect()
    if not await tg_client.is_user_authorized():
        console.print("[red]Error: Not logged in. Run 'tdrive login' first.[/red]")
        await tg_client.disconnect()
        return

    manager = TDriveManager(
        db_session, 
        tg_client, 
        config["channel_id"], 
        password, 
        bytes.fromhex(config["master_salt"])
    )
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        
        task_id = progress.add_task(f"Uploading {path_str}...", total=100)
        
        def update_progress(current, total):
            percent = (current / total) * 100
            progress.update(task_id, completed=percent)

        try:
            file_id = await manager.upload_file(path_str, virtual_path, update_progress)
            console.print(f"\n[bold green]Upload Complete![/bold green] File ID: [white]{file_id}[/white]")
        except Exception as e:
            console.print(f"\n[bold red]Upload Failed:[/bold red] {str(e)}")
            raise typer.Exit(1)
        finally:
            await tg_client.disconnect()
