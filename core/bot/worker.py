"""
TDrive Telegram Bot Worker.

Listens for commands via the Telegram Bot API and executes 
actions via the BotBridge.
"""

import asyncio
import logging
import uuid
from typing import Optional, Dict
from telethon import TelegramClient, events, functions, types
from core.session import SessionManager
from core.bot.bridge import BotBridge
from core.feature_registry import FeatureRegistry, FeatureID

logger = logging.getLogger(__name__)

class TDriveBotWorker:
    def __init__(self, sm: SessionManager):
        self.sm = sm
        self.bridge = BotBridge(sm)
        self.registry = FeatureRegistry(sm)
        self.client = None
        self.username = None
        self._running = False
        self.payload_registry: Dict[str, str] = {} 

    def _register_payload(self, payload: str) -> str:
        """Registers a payload and returns a short ID (8 chars)."""
        for kid, val in self.payload_registry.items():
            if val == payload:
                return kid
        
        reg_id = uuid.uuid4().hex[:8]
        self.payload_registry[reg_id] = payload
        return reg_id

    def _get_payload(self, reg_id: str) -> Optional[str]:
        """Retrieves payload from registry."""
        return self.payload_registry.get(reg_id)

    def validate_callback_data(self, data: bytes) -> bool:
        """
        Validates if callback data is safe for Telegram.
        Rules: max 64 bytes, ASCII only.
        """
        if len(data) > 64:
            logger.warning(f"[BOT WARNING] invalid_callback_data=too_long bytes={len(data)}")
            return False
        
        try:
            data.decode('ascii')
        except UnicodeDecodeError:
            logger.warning(f"[BOT WARNING] invalid_callback_data=non_ascii data={data!r}")
            return False
            
        return True

    def _is_uuid(self, val: str) -> bool:
        """Checks if a string is a UUID."""
        return len(val) == 36 and val.count("-") == 4

    def is_connected(self) -> bool:
        """Returns True if the bot client is connected and authorized."""
        return self.client and self.client.is_connected() and self._running

    async def _register_commands(self):
        """Registers bot commands with Telegram (Bot Menu)."""
        if not self.client:
            return
            
        logger.info("BotWorker: Registering commands with Telegram...")
        commands = [
            types.BotCommand(command="start", description="Main menu"),
            types.BotCommand(command="list", description="Browse files"),
            types.BotCommand(command="search", description="Search files"),
            types.BotCommand(command="recent", description="Recent uploads"),
            types.BotCommand(command="starred", description="Starred files"),
            types.BotCommand(command="storage", description="Storage summary"),
            types.BotCommand(command="jobs", description="Background jobs"),
            types.BotCommand(command="trash", description="Trash bin"),
            types.BotCommand(command="status", description="System status"),
            types.BotCommand(command="help", description="Show help"),
        ]
        
        try:
            await self.client(functions.bots.SetBotCommandsRequest(
                commands=commands,
                scope=types.BotCommandScopeDefault(),
                lang_code=""
            ))
            logger.info("BotWorker: Bot commands registered successfully.")
        except Exception as e:
            logger.error(f"BotWorker: Failed to register commands: {e}")

    async def _send_main_menu(self, event, edit=False):
        """Displays the professional main menu."""
        msg = (
            "<b>TDrive Cloud</b>\n"
            "Remote Control Interface\n\n"
            "Select an action:"
        )
        buttons = [
            [
                types.KeyboardButtonCallback(text="Files", data=b"menu:files"),
                types.KeyboardButtonCallback(text="Search", data=b"menu:search")
            ],
            [
                types.KeyboardButtonCallback(text="Storage", data=b"menu:storage"),
                types.KeyboardButtonCallback(text="Jobs", data=b"menu:jobs")
            ],
            [
                types.KeyboardButtonCallback(text="Starred", data=b"menu:starred"),
                types.KeyboardButtonCallback(text="Trash", data=b"menu:trash")
            ],
            [
                types.KeyboardButtonCallback(text="Status", data=b"menu:status"),
                types.KeyboardButtonCallback(text="Help", data=b"menu:help")
            ]
        ]
        if edit:
            await event.edit(msg, buttons=buttons, parse_mode='html')
        else:
            await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_list(self, event, path, page=1, edit=False):
        """Helper to fetch and display file list with buttons."""
        if path and path != "/" and not path.startswith("/") and not self._is_uuid(path):
            path = f"/{path}"

        result = await self.bridge.handle_list_files(path, page=page)
        
        if not result["success"]:
            msg = f"Error: {result.get('error')}"
            if edit: await event.edit(msg, parse_mode='html')
            else: await event.respond(msg, parse_mode='html')
            return

        files = result["data"]
        current_path = result["path"]
        pagination = result["pagination"]
        
        msg = f"<b>Path:</b> <code>{current_path}</code>\n"
        if not files and page == 1:
            msg += "\n<i>Folder is empty.</i>"
        
        buttons = []
        for f in files:
            reg_id = self._register_payload(f['file_id'] if not f['is_folder'] else f"{current_path.rstrip('/')}/{f['filename']}")
            prefix = "DIR " if f["is_folder"] else ""
            if f["is_folder"]:
                cb_data = f"list:{reg_id}:1".encode()
                buttons.append([types.KeyboardButtonCallback(text=f"{prefix}{f['filename']}", data=cb_data)])
            else:
                size_str = self._format_size(f["size"])
                cb_data = f"info:{reg_id}".encode()
                buttons.append([types.KeyboardButtonCallback(text=f"{f['filename']} ({size_str})", data=cb_data)])

        # Pagination and Navigation
        nav_buttons = []
        path_id = self._register_payload(current_path)
        if pagination["total_pages"] > 1:
            if pagination["current_page"] > 1:
                nav_buttons.append(types.KeyboardButtonCallback(text="Previous", data=f"list:{path_id}:{pagination['current_page'] - 1}".encode()))
            
            nav_buttons.append(types.KeyboardButtonCallback(text=f"Page {pagination['current_page']}/{pagination['total_pages']}", data=b"noop"))

            if pagination["current_page"] < pagination["total_pages"]:
                nav_buttons.append(types.KeyboardButtonCallback(text="Next", data=f"list:{path_id}:{pagination['current_page'] + 1}".encode()))
        
        if nav_buttons:
            buttons.append(nav_buttons)

        # Back to parent
        back_buttons = [types.KeyboardButtonCallback(text="Back", data=b"menu:files" if current_path == "/" else f"list:{self._register_payload(current_path.rsplit('/', 1)[0] or '/')}:1".encode())]
        back_buttons.append(types.KeyboardButtonCallback(text="Menu", data=b"menu:main"))
        buttons.append(back_buttons)

        if edit:
            await event.edit(msg, buttons=buttons, parse_mode='html')
        else:
            await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_storage(self, event, edit=False):
        """Displays storage summary."""
        result = await self.bridge.handle_storage_summary()
        if not result["success"]:
            await event.respond(f"Error: {result.get('error')}", parse_mode='html')
            return

        msg = (
            "<b>Storage Summary</b>\n\n"
            f"Files: {result['total_files']}\n"
            f"Folders: {result['total_folders']}\n"
            f"Used: {self._format_size(result['used_storage'])}\n"
            f"Trash: {self._format_size(result['trash_size'])} ({result['trash_count']} items)\n"
        )
        if result['largest_file']:
            msg += f"Largest: {result['largest_file']['filename']} ({self._format_size(result['largest_file']['size'])})\n"
        
        buttons = [[types.KeyboardButtonCallback(text="Main Menu", data=b"menu:main")]]
        if edit: await event.edit(msg, buttons=buttons, parse_mode='html')
        else: await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_status(self, event, edit=False):
        """Displays system status."""
        status = await self.bridge.handle_system_status()
        if not status["success"]:
            await event.respond(f"Error: {status.get('error')}", parse_mode='html')
            return

        msg = (
            "<b>System Status</b>\n\n"
            f"State: {status['state']}\n"
            f"Access: {status['mode']}\n"
            f"Database: {status['db_status']}\n"
            f"API: {status['api_status']}\n"
            f"Telegram: {status['tg_status']}\n\n"
            f"<i>{status['message']}</i>"
        )
        buttons = [[types.KeyboardButtonCallback(text="Main Menu", data=b"menu:main")]]
        if edit: await event.edit(msg, buttons=buttons, parse_mode='html')
        else: await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_recent(self, event, page=1, edit=False):
        """Displays recent uploads."""
        result = await self.bridge.handle_list_recent(page=page)
        if not result["success"]:
            await event.respond(f"Error: {result.get('error')}", parse_mode='html')
            return

        files = result["data"]
        pagination = result["pagination"]
        msg = "<b>Recent Uploads</b>\n"
        if not files:
            msg += "\n<i>No recent uploads found.</i>"
        
        buttons = []
        for f in files:
            reg_id = self._register_payload(f['file_id'])
            size_str = self._format_size(f["size"])
            buttons.append([types.KeyboardButtonCallback(text=f"{f['filename']} ({size_str})", data=f"info:{reg_id}".encode())])

        nav_buttons = []
        if pagination["total_pages"] > 1:
            if pagination["current_page"] > 1:
                nav_buttons.append(types.KeyboardButtonCallback(text="Previous", data=f"recent:{pagination['current_page'] - 1}".encode()))
            nav_buttons.append(types.KeyboardButtonCallback(text=f"Page {pagination['current_page']}/{pagination['total_pages']}", data=b"noop"))
            if pagination["current_page"] < pagination["total_pages"]:
                nav_buttons.append(types.KeyboardButtonCallback(text="Next", data=f"recent:{pagination['current_page'] + 1}".encode()))
        
        if nav_buttons: buttons.append(nav_buttons)
        buttons.append([types.KeyboardButtonCallback(text="Main Menu", data=b"menu:main")])

        if edit: await event.edit(msg, buttons=buttons, parse_mode='html')
        else: await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_trash(self, event, edit=False):
        """Displays trash bin."""
        result = await self.bridge.handle_list_trash()
        if not result["success"]:
            await event.respond(f"Error: {result.get('error')}", parse_mode='html')
            return

        files = result["data"]
        msg = "<b>Trash Bin</b>\n"
        if not files:
            msg += "\n<i>Trash bin is empty.</i>"
        
        buttons = []
        for f in files:
            reg_id = self._register_payload(f['file_id'])
            buttons.append([types.KeyboardButtonCallback(text=f"Restore {f['filename']}", data=f"restore:{reg_id}".encode())])

        buttons.append([types.KeyboardButtonCallback(text="Main Menu", data=b"menu:main")])

        if edit: await event.edit(msg, buttons=buttons, parse_mode='html')
        else: await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_jobs(self, event, page=1, edit=False):
        """Displays background jobs."""
        result = await self.bridge.handle_list_jobs(page=page)
        if not result["success"]:
            await event.respond(f"Error: {result.get('error')}", parse_mode='html')
            return

        jobs = result["data"]
        pagination = result["pagination"]
        msg = "<b>Background Jobs</b>\n"
        if not jobs:
            msg += "\n<i>No jobs found.</i>"
        
        for j in jobs:
            progress = f"{j['progress']}%" if j['status'] == 'running' else j['status'].capitalize()
            msg += f"\n• {j['type'].upper()} | {progress} | <code>{j['job_id'][:8]}</code>"

        buttons = []
        nav_buttons = []
        if pagination["total_pages"] > 1:
            if pagination["current_page"] > 1:
                nav_buttons.append(types.KeyboardButtonCallback(text="Previous", data=f"jobs:{pagination['current_page'] - 1}".encode()))
            nav_buttons.append(types.KeyboardButtonCallback(text=f"Page {pagination['current_page']}/{pagination['total_pages']}", data=b"noop"))
            if pagination["current_page"] < pagination["total_pages"]:
                nav_buttons.append(types.KeyboardButtonCallback(text="Next", data=f"jobs:{pagination['current_page'] + 1}".encode()))
        
        if nav_buttons: buttons.append(nav_buttons)
        buttons.append([
            types.KeyboardButtonCallback(text="Refresh", data=f"jobs:{page}".encode()),
            types.KeyboardButtonCallback(text="Menu", data=b"menu:main")
        ])

        if edit: await event.edit(msg, buttons=buttons, parse_mode='html')
        else: await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_starred(self, event, page=1, edit=False):
        """Displays starred files."""
        result = await self.bridge.handle_list_starred(page=page)
        if not result["success"]:
            await event.respond(f"Error: {result.get('error')}", parse_mode='html')
            return

        files = result["data"]
        pagination = result["pagination"]
        msg = "<b>Starred Files</b>\n"
        if not files:
            msg += "\n<i>No starred files found.</i>"
        
        buttons = []
        for f in files:
            reg_id = self._register_payload(f['file_id'])
            buttons.append([types.KeyboardButtonCallback(text=f"{f['filename']}", data=f"info:{reg_id}".encode())])

        nav_buttons = []
        if pagination["total_pages"] > 1:
            if pagination["current_page"] > 1:
                nav_buttons.append(types.KeyboardButtonCallback(text="Previous", data=f"starred:{pagination['current_page'] - 1}".encode()))
            nav_buttons.append(types.KeyboardButtonCallback(text=f"Page {pagination['current_page']}/{pagination['total_pages']}", data=b"noop"))
            if pagination["current_page"] < pagination["total_pages"]:
                nav_buttons.append(types.KeyboardButtonCallback(text="Next", data=f"starred:{pagination['current_page'] + 1}".encode()))
        
        if nav_buttons: buttons.append(nav_buttons)
        buttons.append([types.KeyboardButtonCallback(text="Main Menu", data=b"menu:main")])

        if edit: await event.edit(msg, buttons=buttons, parse_mode='html')
        else: await event.respond(msg, buttons=buttons, parse_mode='html')

    async def _send_info(self, event, file_id, edit=False):
        """Displays detailed file information."""
        result = await self.bridge.handle_get_file_info(file_id)
        if not result["success"]:
            await event.respond(f"Error: {result.get('error')}", parse_mode='html')
            return

        f = result["data"]
        msg = (
            f"<b>File Details</b>\n\n"
            f"Name: {f['filename']}\n"
            f"Size: {self._format_size(f['size'])}\n"
            f"Path: <code>{f['path']}</code>\n"
            f"SHA256: <code>{f['sha256'][:16]}...</code>\n"
            f"Chunks: {f['chunks']}\n"
            f"Created: {f['created_at'].strftime('%Y-%m-%d %H:%M')}\n"
            f"Status: {f['status'].capitalize()}\n"
        )
        
        reg_id = self._register_payload(f['file_id'])
        buttons = [
            [types.KeyboardButtonCallback(text="Get Download Link", data=f"download:{reg_id}".encode())],
            [types.KeyboardButtonCallback(text="Back", data=f"list:{self._register_payload(f['path'])}:1".encode())],
            [types.KeyboardButtonCallback(text="Main Menu", data=b"menu:main")]
        ]
        
        if edit: await event.edit(msg, buttons=buttons, parse_mode='html')
        else: await event.respond(msg, buttons=buttons, parse_mode='html')

    async def start(self):
        """Starts the bot client."""
        config = self.sm.load_config()
        bot_token = config.get("bot_token")
        
        if not bot_token:
            logger.warning("BotWorker: No bot_token found in config. Bot will not start.")
            self.username = None
            return

        if not self.registry.is_enabled(FeatureID.BOT_INTERFACE):
            logger.info("BotWorker: Bot Interface is disabled in settings.")
            self.username = None
            return

        logger.info("BotWorker: Starting Telegram Bot...")
        
        self.client = TelegramClient(
            str(self.sm.config_dir / "tdrive_bot.session"),
            config["api_id"],
            config["api_hash"]
        )

        @self.client.on(events.NewMessage(pattern='/start'))
        async def start_handler(event):
            await self._send_main_menu(event)

        @self.client.on(events.NewMessage(pattern='/help'))
        async def help_handler(event):
            msg = (
                "<b>TDrive Bot Help</b>\n\n"
                "<b>Files</b>\n"
                "/list [path] - Browse files\n"
                "/search <query> - Search files\n"
                "/recent - Recent uploads\n"
                "/starred - Starred files\n\n"
                "<b>System</b>\n"
                "/storage - Storage stats\n"
                "/jobs - Background jobs\n"
                "/status - System health\n\n"
                "<b>Management</b>\n"
                "/trash - Trash bin\n"
                "/info <file_id> - File details\n"
            )
            await event.respond(msg, parse_mode='html')

        @self.client.on(events.NewMessage(pattern='/status'))
        async def status_handler(event):
            await self._send_status(event)

        @self.client.on(events.NewMessage(pattern='/list'))
        async def list_handler(event):
            parts = event.message.text.split(' ', 1)
            path = parts[1] if len(parts) > 1 else "/"
            await self._send_list(event, path, page=1)

        @self.client.on(events.NewMessage(pattern='/storage'))
        async def storage_handler(event):
            await self._send_storage(event)

        @self.client.on(events.NewMessage(pattern='/recent'))
        async def recent_handler(event):
            await self._send_recent(event)

        @self.client.on(events.NewMessage(pattern='/starred'))
        async def starred_handler(event):
            await self._send_starred(event)

        @self.client.on(events.NewMessage(pattern='/jobs'))
        async def jobs_handler(event):
            await self._send_jobs(event)

        @self.client.on(events.NewMessage(pattern='/trash'))
        async def trash_handler(event):
            await self._send_trash(event)

        @self.client.on(events.NewMessage(pattern='/search'))
        async def search_handler(event):
            parts = event.message.text.split(' ', 1)
            if len(parts) < 2:
                await event.respond("🔍 Usage: <code>/search &lt;query&gt;</code>", parse_mode='html')
                return
            query = parts[1]
            result = await self.bridge.handle_search_files(query)
            if not result["success"]:
                await event.respond(f"<b>Error:</b> {result.get('error')}", parse_mode='html')
                return
            files = result["data"]
            if not files:
                await event.respond(f"No results for <code>{query}</code>", parse_mode='html')
                return
            
            msg = f"<b>Search:</b> {query}\n"
            buttons = []
            for f in files:
                reg_id = self._register_payload(f['file_id'])
                buttons.append([types.KeyboardButtonCallback(text=f"📄 {f['filename']}", data=f"info:{reg_id}".encode())])
            
            buttons.append([types.KeyboardButtonCallback(text="🏠 Menu", data=b"menu:main")])
            await event.respond(msg, buttons=buttons, parse_mode='html')

        @self.client.on(events.NewMessage(pattern='/info'))
        async def info_handler(event):
            parts = event.message.text.split(' ', 1)
            if len(parts) < 2:
                await event.respond("Usage: <code>/info &lt;file_id&gt;</code>", parse_mode='html')
                return
            await self._send_info(event, parts[1])

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('menu:')))
        async def menu_callback_handler(event):
            data = event.data.decode().split(':')[1]
            if data == "main": await self._send_main_menu(event, edit=True)
            elif data == "files": await self._send_list(event, "/", edit=True)
            elif data == "storage": await self._send_storage(event, edit=True)
            elif data == "status": await self._send_status(event, edit=True)
            elif data == "recent": await self._send_recent(event, edit=True)
            elif data == "starred": await self._send_starred(event, edit=True)
            elif data == "jobs": await self._send_jobs(event, edit=True)
            elif data == "trash": await self._send_trash(event, edit=True)
            elif data == "help": await help_handler(event)
            elif data == "search": await event.answer("Use /search <query> to find files.", alert=True)

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('list:')))
        async def list_callback_handler(event):
            data = event.data.decode().split(':')
            reg_id, page = data[1], int(data[2])
            path = self._get_payload(reg_id)
            if not path:
                await event.answer("Session expired. Please use /list.", alert=True)
                return
            await self._send_list(event, path, page=page, edit=True)

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('recent:')))
        async def recent_callback_handler(event):
            page = int(event.data.decode().split(':')[1])
            await self._send_recent(event, page=page, edit=True)

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('jobs:')))
        async def jobs_callback_handler(event):
            page = int(event.data.decode().split(':')[1])
            await self._send_jobs(event, page=page, edit=True)

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('starred:')))
        async def starred_callback_handler(event):
            page = int(event.data.decode().split(':')[1])
            await self._send_starred(event, page=page, edit=True)

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('info:')))
        async def info_callback_handler(event):
            reg_id = event.data.decode().split(':')[1]
            file_id = self._get_payload(reg_id)
            if not file_id:
                await event.answer("Session expired.", alert=True)
                return
            await self._send_info(event, file_id, edit=True)

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('restore:')))
        async def restore_callback_handler(event):
            reg_id = event.data.decode().split(':')[1]
            file_id = self._get_payload(reg_id)
            if not file_id:
                await event.answer("Session expired.", alert=True)
                return
            result = await self.bridge.handle_restore_file(file_id)
            if result["success"]:
                await event.answer("File restored successfully.", alert=True)
                await self._send_trash(event, edit=True)
            else:
                await event.answer(f"Error: {result.get('error')}", alert=True)

        @self.client.on(events.CallbackQuery(data=lambda x: x.decode().startswith('download:')))
        async def download_callback_handler(event):
            reg_id = event.data.decode().split(':')[1]
            file_id = self._get_payload(reg_id)
            if not file_id:
                await event.answer("Session expired.", alert=True)
                return
            result = self.bridge.generate_secure_ticket(file_id)
            if result["success"]:
                await event.respond(f"<b>Ticket:</b> <code>{result['ticket']}</code>\n\nUse this ticket in the Web UI or CLI to download.", parse_mode='html')
            else:
                await event.answer(f"Error: {result.get('error')}", alert=True)

        @self.client.on(events.CallbackQuery(data=b'noop'))
        async def noop_callback_handler(event):
            await event.answer()

        try:
            await self.client.start(bot_token=bot_token)
            me = await self.client.get_me()
            self.username = me.username
            self._running = True
            logger.info(f"BotWorker: Bot @{self.username} is now online.")
            await self._register_commands()
            await self.client.run_until_disconnected()
        except Exception as e:
            logger.error(f"BotWorker: Critical error: {e}")
            self.username = None
        finally:
            self._running = False
            self.username = None

        try:
            await self.client.start(bot_token=bot_token)
            me = await self.client.get_me()
            self.username = me.username
            self._running = True
            logger.info(f"BotWorker: Bot @{self.username} is now online.")
            await self._register_commands()
            await self.client.run_until_disconnected()
        except Exception as e:
            logger.error(f"BotWorker: Critical error: {e}")
            self.username = None
        finally:
            self._running = False
            self.username = None

    def _format_size(self, size: int) -> str:
        """Helper to format bytes to human readable string."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    async def stop(self):
        """Stops the bot client."""
        if self.client:
            await self.client.disconnect()
            self._running = False
            self.username = None
