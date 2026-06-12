# TDrive CLI Command Reference

The TDrive Command Line Interface (CLI) provides powerful administrative tools for managing your personal cloud storage without the web dashboard.

## Installation

To install the CLI globally within your environment:
```bash
source venv/bin/activate
pip install .
```

## Global Setup

Check the installed version:
```bash
tdrive version
```

## 1. Initial Setup

### System Initialization
Sets up the base configuration, API keys, and initializes the encryption salt.
```bash
tdrive init
```
**Inputs required:**
- API ID & API Hash (from my.telegram.org)
- Telegram Channel ID (where files will be stored)
- **Master Password**: This will be used to derive your encryption keys.

### Authentication
Logs you into Telegram and saves the session file.
```bash
tdrive login
```

---

## 2. File Operations

### List Files
Lists files in the virtual filesystem.
```bash
tdrive ls
```
You can also list a specific path:
```bash
tdrive ls /Movies
```

### Upload a File
Uploads a local file to the cloud.
```bash
tdrive upload /path/to/local/file.zip
```
**Options:**
- `--vpath`: Specify the virtual folder (e.g., `--vpath /Backups`).

### Download a File
Downloads a file from the cloud to your local machine.
```bash
tdrive download <file_id_or_sha256> --output /path/to/destination
```

### Remove a File
Permanently deletes a file from the cloud and Telegram.
```bash
tdrive rm <file_id>
```

---

## 3. Maintenance & Recovery

### Audit Integrity
Checks if the local database is in sync with the Telegram storage channel.
```bash
tdrive maintenance audit
```

### Rebuild Index (Self-Healing)
The most critical recovery tool. Use this to restore your database if `tdrive.db` is lost or corrupted.
```bash
tdrive maintenance rebuild
```
*Note: This will verify HMAC signatures of all metadata on Telegram.*

### Clean Orphaned Chunks
Cleans up "garbage" chunks in Telegram that don't belong to any registered file.
```bash
tdrive maintenance cleanup
```

---

## 4. Diagnostics

### Doctor Tool
Checks the health of all system components (Config, DB, Telegram connection).
```bash
tdrive doctor
```

## Tips
- Always keep your **Master Password** safe. The CLI cannot recover files if the password is lost.
- Use the **Doctor** tool first if you experience connection issues.
