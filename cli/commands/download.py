import typer
from pathlib import Path
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from core.manager import TDriveManager
from core.session import SessionManager
from core.client import TDriveClient
from core.db.session import DatabaseSession
from core.db.manager import DBManager

console = Console()

async def handle_download(file_id: str, output: str = None):
    sm = SessionManager()
    config = sm.load_config()
    if not config:
        console.print("[red]Error: TDrive not initialized.[/red]")
        return

    password = typer.prompt("Enter Master Password", hide_input=True)
    
    db_path = sm.config_dir / "tdrive.db"
    db_session = DatabaseSession(str(db_path))
    
    tg_client = TDriveClient(
        sm.config_dir / "tdrive.session", 
        config["api_id"], 
        config["api_hash"]
    )
    
    await tg_client.connect()
    
    manager = TDriveManager(
        db_session, 
        tg_client, 
        config["channel_id"], 
        password, 
        bytes.fromhex(config["master_salt"])
    )
    
    if not output:
        with db_session.get_session() as session:
            db = DBManager(session)
            f_rec = db.get_file(file_id)
            if not f_rec:
                console.print(f"[red]File {file_id} not found in DB.[/red]")
                await tg_client.disconnect()
                return
            output = f_rec.filename
            
    out_path = Path(output)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        
        task_id = progress.add_task(f"Downloading {file_id}...", total=100)
        
        def update_progress(current, total):
            percent = (current / total) * 100
            progress.update(task_id, completed=percent)

        try:
            await manager.download_file(file_id, out_path, update_progress)
            console.print(f"\n[bold green]Download Complete![/bold green] Saved to: [white]{out_path}[/white]")
        except Exception as e:
            console.print(f"\n[bold red]Download Failed:[/bold red] {str(e)}")
            raise typer.Exit(1)
        finally:
            await tg_client.disconnect()
