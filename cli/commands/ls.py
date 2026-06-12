import typer
from rich.console import Console
from rich.table import Table
from core.session import SessionManager
from core.db.session import DatabaseSession
from core.db.manager import DBManager

console = Console()

def handle_ls(path: str = "/"):
    """List files in TDrive."""
    sm = SessionManager()
    db_path = sm.config_dir / "tdrive.db"
    if not db_path.exists():
        console.print("[yellow]No database found. Upload some files first.[/yellow]")
        return

    db_session = DatabaseSession(str(db_path))
    
    with db_session.get_session() as session:
        db = DBManager(session)
        files = db.list_files(path)
        
        if not files:
            console.print(f"No files found in {path}")
            return

        table = Table(title=f"Files in {path}")
        table.add_column("File ID", style="dim", no_wrap=True)
        table.add_column("Filename", style="cyan")
        table.add_column("Size", justify="right")
        table.add_column("Status", style="green")
        table.add_column("Uploaded At")

        for f in files:
            size_mb = f"{f.size / (1024*1024):.2f} MB"
            table.add_row(
                f.file_id[:12] + "...", 
                f.filename, 
                size_mb, 
                f.status, 
                f.created_at.strftime("%Y-%m-%d %H:%M")
            )

        console.print(table)
