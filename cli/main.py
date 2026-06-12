"""
TDrive CLI Entry Point.
"""

import asyncio
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console

from cli.commands import init, login, upload, download, ls, rm, doctor, maintenance, backup
from core import __version__

console = Console()

app = typer.Typer(
    help="TDrive: Telegram-Backend Personal Cloud Storage",
    rich_markup_mode="rich"
)

# Init Group
init_app = typer.Typer(help="Initialize TDrive configuration and directory.", invoke_without_command=True)
@init_app.callback()
def init_callback(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        init.handle_init()
@init_app.command(name="init-cmd", hidden=True)
def init_old():
    init.handle_init()
app.add_typer(init_app, name="init")

# Login Group
login_app = typer.Typer(help="Log in to Telegram and create a session.", invoke_without_command=True)
@login_app.callback()
def login_callback(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        login.handle_login()
@login_app.command(name="login-cmd", hidden=True)
def login_old():
    login.handle_login()
app.add_typer(login_app, name="login")

# LS Group
ls_app = typer.Typer(help="List files in TDrive.", invoke_without_command=True)
@ls_app.callback()
def ls_callback(ctx: typer.Context, path: str = typer.Argument("/", help="Virtual path to list")):
    if ctx.invoked_subcommand is None:
        ls.handle_ls(path)
@ls_app.command(name="ls-cmd", hidden=True)
def ls_old(path: str = typer.Argument("/", help="Virtual path to list")):
    ls.handle_ls(path)
app.add_typer(ls_app, name="ls")

# Doctor Group
doctor_app = typer.Typer(help="Check the health of TDrive components.", invoke_without_command=True)
@doctor_app.callback()
def doctor_callback(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        doctor.handle_doctor()
@doctor_app.command(name="doctor-cmd", hidden=True)
def doctor_old():
    doctor.handle_doctor()
app.add_typer(doctor_app, name="doctor")

# Add maintenance and backup as command groups
app.add_typer(maintenance.app, name="maintenance")
app.add_typer(backup.app, name="backup")

@app.command(name="version")
def version_cmd():
    """Display TDrive version."""
    console.print(f"TDrive [bold cyan]v{__version__}[/bold cyan]")

@app.command(name="run")
def run_cmd():
    """Open TDrive Web UI in Firefox (Private Window)."""
    import subprocess
    import platform
    
    url = "http://localhost:3000"
    console.print(f"Opening [bold cyan]{url}[/bold cyan] in Firefox Private Mode...")
    
    try:
        system = platform.system()
        if system == "Linux":
            subprocess.Popen(["firefox", "--private-window", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Windows":
            subprocess.Popen(["start", "firefox", "-private-window", url], shell=True)
        else:
            import webbrowser
            webbrowser.open(url)
    except Exception as e:
        console.print(f"[red]Failed to open browser: {e}[/red]")
        console.print(f"Please open manually: [link={url}]{url}[/link]")

@app.command(name="upload")
def upload_cmd(
    path: str = typer.Argument(..., help="Path to file or folder"),
    virtual_path: str = typer.Option("/", "--vpath", help="Virtual folder path in TDrive")
):
    """[bold green]Upload[/bold green] a file to TDrive."""
    asyncio.run(upload.handle_upload(path, virtual_path))

@app.command(name="download")
def download_cmd(
    file_id: str = typer.Argument(..., help="File ID or SHA256"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output path")
):
    """[bold blue]Download[/bold blue] a file from TDrive."""
    asyncio.run(download.handle_download(file_id, output))

@app.command(name="rm")
def rm_cmd(file_id: str = typer.Argument(..., help="File ID to delete")):
    """[bold red]Remove[/bold red] a file from TDrive and Telegram."""
    asyncio.run(rm.handle_rm(file_id))

@app.command(name="verify-instance")
def verify_instance_cmd(
    reset: bool = typer.Option(False, "--reset", help="Force regenerate the instance fingerprint lock")
):
    """[bold cyan]Authorize[/bold cyan] the current environment/instance."""
    from core.integrity import IntegrityGuard
    guard = IntegrityGuard()
    
    status = guard.get_integrity_status()
    if status["state"] == "FULL_ACCESS" and not reset:
        console.print("[bold green]Instance is already verified and authorized.[/bold green]")
        return

    if guard.is_ci_environment():
        console.print("[bold yellow]Warning:[/bold yellow] CI environment detected. Manual verification is temporary.")
    
    password = typer.prompt("Enter Master Password to authorize this machine", hide_input=True)
    
    if guard.verify_instance(password, reset=reset):
        console.print("[bold green]Success![/bold green] Instance fingerprint verified and locked.")
        console.print("[dim]This machine is now authorized to perform write operations.[/dim]")
    else:
        console.print("[bold red]Error:[/bold red] Verification failed. Check your password or run 'tdrive init' first.")

if __name__ == "__main__":
    app()
