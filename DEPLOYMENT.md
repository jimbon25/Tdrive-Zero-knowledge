# TDrive Production Deployment Guide

This guide covers how to deploy TDrive in a production environment using Docker Compose or systemd.

---

## 1. Prerequisites
- Docker & Docker Compose
- A Telegram account with API ID and Hash (from https://my.telegram.org)
- A private Telegram channel for storage.

---

## 2. Option A: Docker Compose (Recommended)

1. **Clone and Prepare**:
   ```bash
   mkdir -p ~/.tdrive
   ```

2. **Configure Nginx**:
   If you want HTTPS, place your certificates in `./deploy/certs/` and update `deploy/nginx/conf.d/default.conf` to listen on port 443 with SSL enabled.

3. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```

4. **Initialize TDrive**:
   Access the CLI inside the container:
   ```bash
   docker exec -it tdrive-api tdrive init
   docker exec -it tdrive-api tdrive login
   ```

5. **Access**:
   Open `http://your-server-ip` in your browser.

---

## 3. Option B: Native Deployment (systemd)

1. **Install Backend**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install .
   ```

2. **Initialize**:
   ```bash
   tdrive init
   tdrive login
   ```

3. **Setup systemd**:
   ```bash
   cp deploy/tdrive-agent.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable tdrive-agent
   sudo systemctl start tdrive-agent
   ```

---

## 4. Secure Remote Access

### Cloudflare Tunnel (Recommended)
1. Install `cloudflared` on your server.
2. Run:
   ```bash
   cloudflared tunnel create tdrive
   cloudflared tunnel route dns tdrive tdrive.yourdomain.com
   ```
3. Configure the tunnel to point to `http://localhost:80` (the Nginx proxy).
4. Cloudflare provides automatic HTTPS and global CDN.

### Tailscale Funnel
If you use Tailscale:
```bash
tailscale funnel 443 on
tailscale funnel 443 proxy 80
```

---

## 5. Maintenance & Backups

### Automated Backups
Add a crontab entry to backup TDrive weekly:
```bash
0 0 * * 0 /home/user/Tdrive/venv/bin/tdrive backup create -o /backups/tdrive_$(date +\%F).zip
```

### Log Rotation
Docker handles log rotation via the `json-file` driver by default. For systemd, logs are managed by `journalctl`.

---

## 6. Health Checks
Check status via CLI:
```bash
tdrive maintenance audit
tdrive doctor
```
Or via API: `GET /api/v1/system/status`
