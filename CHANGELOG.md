# Changelog

## [1.4.0] - 2026-06-12

### Added
- **Global CLI Entry Point**: Introduced the `tdrive` command, allowing users to interact with the system from any directory without using `python3 -m cli.main`.
- **Packaging Infrastructure**: Added `pyproject.toml` as the primary configuration for Python packaging, dependency management, and distribution.
- **Version Command**: Added `tdrive version` to display the current application version.
- **Run Command**: Added `tdrive run` to quickly open the Web UI in a Firefox Private Window (supports Linux and Windows).
- **Core Package Init**: Created `core/__init__.py` to hold the application versioning state.

### Changed
- **CLI Command Simplification**: Refactored the command structure for better UX:
  - `init-cmd` simplified to `tdrive init`.
  - `login-cmd` simplified to `tdrive login`.
  - `ls-cmd` simplified to `tdrive ls`.
  - `doctor-cmd` simplified to `tdrive doctor`.
- **CLI Architecture Refactor**: Separated command logic from the main entry point into modular files in `cli/commands/` for better maintainability.
- **Dependency Management**: Transitioned from a static `requirements.txt` to a dynamic dependency resolution system via `pyproject.toml`.
- **Enhanced Help System**: Upgraded the CLI help output using `typer` and `rich` readable terminal experience.
- **Exit Code Standardization**: Standardized exit codes (0 for success, 1 for failure) across critical commands like `upload` and `download` for better automation support.
- **Updated Documentation**: Completely overhauled `README.md`, `DEPLOYMENT.md`, and all files in `docs/` to reflect the new CLI standards and installation methods.

### Fixed
- **CLI NameError**: Fixed a bug where the `console` instance was missing in refactored command modules (doctor, init, ls, login).
- **Documentation Mismatches**: Fixed several typos and incorrect command references in `docs/cli.md` (e.g., `rebuild-index` corrected to `rebuild`).
- **Path Portability**: Improved path handling in `cli/main.py` and `core/session.py` to ensure better cross-platform support.

### Security
- **Secure Permissions Handling**: Refined `core/utils.py` to handle POSIX permissions gracefully on Windows (graceful no-op) while maintaining strict security on Linux.
- **Automation Guard**: Maintained interactive prompts for sensitive operations while paving the way for future non-interactive automation flags.

---
