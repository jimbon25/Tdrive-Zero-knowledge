# Repository Integrity Guard

Security layer to detect unauthorized environment changes.

## 1. Overview
The **Integrity Guard** helps prevent unauthorized data modification if your configuration or repository is cloned to a new machine. It ensures that destructive operations like file deletion require explicit authorization.

## 2. Mechanism: Instance Fingerprinting
TDrive generates a fingerprint based on:
1.  **Master Salt**: Unique string from `config.json`.
2.  **Channel ID**: Your Telegram storage ID.
3.  **Machine ID**: Local hardware identifier.

These are hashed and stored in `~/.tdrive/instance.lock`.

## 3. System States

| State | Condition | Impact |
| :--- | :--- | :--- |
| **INIT** | No config found. | Setup required. |
| **LOCKED** | Config exists, machine not verified. | **Safe Mode** (Read-Only). |
| **SAFE_MODE** | Mismatch or CI detected. | Writes blocked; Read/Download allowed. |
| **FULL_ACCESS** | Verified environment. | Full Read/Write access. |

## 4. Safe Mode Behavior

### ✅ Allowed:
*   Listing files and folders.
*   File previews and downloads.
*   Manual Index Rebuild.

### ❌ Blocked:
*   File uploads.
*   Deleting files or folders.
*   Renaming items.
*   Automatic background maintenance.

## 5. CI/CD Environment
The system detects CI platforms (GitHub Actions, etc.) and defaults to **Read-Only Mode** to prevent data manipulation during automated tests.

## 6. CLI Commands

### Authorize Machine
If you see an "Environment Not Authorized" warning:
```bash
tdrive verify-instance
```
*Requires Master Password confirmation.*

### Reset Fingerprint
To update the lock for a new machine:
```bash
tdrive verify-instance --reset
```
