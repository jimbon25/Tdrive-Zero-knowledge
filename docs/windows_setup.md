# 🪟 Windows Setup Guide for TDrive

This guide provides detailed instructions for setting up TDrive on a Windows environment. There are three primary methods: **WSL2 (Recommended)**, **Docker Desktop**, and **Native PowerShell**.

---

## 🚀 Method 1: WSL2 (Highly Recommended)

WSL2 (Windows Subsystem for Linux) is the most stable and performant way to run TDrive on Windows, as it provides a native Linux kernel.

### 1. Prerequisites
- Open PowerShell as Administrator and run:
  ```powershell
  wsl --install
  ```
- Restart your computer if prompted.
- Install a Linux distribution (Ubuntu is default) from the Microsoft Store.

### 2. Installation
Open your Ubuntu terminal and follow the standard Linux installation steps:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install python3-pip python3-venv nodejs npm -y

# Clone and setup
git clone https://github.com/jimbon25/T-drive.git
cd T-drive
python3 -m venv venv
source venv/bin/activate
pip install .

# Configure & Run
tdrive init
tdrive login
cd web && npm install && npm run dev
```

---

## 🐳 Method 2: Docker Desktop (Simplest)

Use this method if you want to avoid installing Python and Node.js directly on your Windows machine.

### 1. Prerequisites
- Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
- Ensure "Use the WSL 2 based engine" is enabled in Docker settings.

### 2. Installation
Open PowerShell in the `T-drive` root folder and run:
```powershell
docker-compose up -d
```
The application will be accessible at `http://localhost:3000`.

---

## 🖥️ Method 3: Native PowerShell (Manual)

Best for quick testing without using virtualization.

### 1. Prerequisites
- Install [Python 3.12+](https://www.python.org/downloads/). Ensure you check **"Add Python to PATH"** during installation.
- Install [Node.js 20+](https://nodejs.org/).

### 2. Backend Setup
Open PowerShell in the `T-drive` root folder:
```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate

# Install dependencies
pip install .

# Initialize configuration
tdrive init

# Authenticate Telegram
tdrive login

# Start the Agent
python -m api.main
```

### 3. Frontend Setup
Open a **new** PowerShell window:
```powershell
cd web
npm install
npm run dev
```

---

## 🛠️ Windows Troubleshooting

### 1. Execution Policy Error
If you cannot activate the virtual environment (`.\venv\Scripts\activate`), run this in PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Long Paths in Git
Windows has a 260-character path limit. Enable long paths if you encounter errors during `npm install`:
```powershell
git config --global core.longpaths true
```

### 3. Database is Locked
If you get a `sqlite3.OperationalError: database is locked`, ensure only one instance of `tdrive-agent` or the CLI is running at a time. Windows is more sensitive to file locks than Linux.

### 4. Background Services
Unlike Linux (`systemd`), Windows does not have a native way to run these scripts as background services out of the box. You can use **NSSM (Non-Sucking Service Manager)** or simply keep the PowerShell windows open.

---

**Next Steps:** After setup, visit `http://localhost:3000` and enter your Master Password to begin. 🛡️💎🚀
