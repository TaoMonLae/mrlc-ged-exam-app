# MRLC GED App — Deployment Guide

## Requirements
- Docker + Docker Compose
- (Optional) Nginx for a real domain
- (Optional) Certbot for HTTPS

---

## Quick Start (Local / Internal)

```bash
cd mrlc-ged-exam-app-v6
docker compose -f docker-compose.sqlite.yml up -d --build
# → http://localhost:4000
# Default login: admin / admin123
```

---

## Production Deployment (with Nginx)

### 1. Deploy the app on port 4000
```bash
docker compose -f docker-compose.sqlite.yml up -d --build
```

### 2. Install Nginx
```bash
sudo apt install nginx -y
```

### 3. Copy the Nginx config
```bash
sudo cp nginx.conf /etc/nginx/sites-available/mrlc-ged
# Edit the server_name line to your IP or domain:
sudo nano /etc/nginx/sites-available/mrlc-ged

sudo ln -s /etc/nginx/sites-available/mrlc-ged /etc/nginx/sites-enabled/
sudo nginx -t        # test config
sudo systemctl reload nginx
```

### 4. (Optional) Free HTTPS with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
# Certbot will auto-edit your nginx config for HTTPS
```

---

## Automatic DB Backups (Cron)

```bash
# Copy backup script
sudo cp backup.sh /usr/local/bin/mrlc-backup.sh
sudo chmod +x /usr/local/bin/mrlc-backup.sh

# Schedule daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/mrlc-backup.sh >> /var/log/mrlc-backup.log 2>&1") | crontab -
```

Backups are saved to `/var/backups/mrlc-ged/`. Last 14 days are kept automatically.

---

## Update / Redeploy

```bash
cd mrlc-ged-exam-app-v6
docker compose -f docker-compose.sqlite.yml down
docker compose -f docker-compose.sqlite.yml up -d --build
```

Your database volume is preserved across rebuilds.

---

## Healthcheck

```bash
curl http://localhost:4000/api/health
# → {"ok":true,"name":"MRLC GED App"}
```

---

## Docker Volume (your data lives here)
```bash
docker volume ls | grep sqlite
docker volume inspect ged-exam-app_sqlite-data
```

To restore a backup:
```bash
docker compose -f docker-compose.sqlite.yml down
docker run --rm \
  -v ged-exam-app_sqlite-data:/data \
  -v /var/backups/mrlc-ged:/backup \
  alpine sh -c "cp /backup/ged-db-YYYY-MM-DD_HH-MM.db /data/app.db"
docker compose -f docker-compose.sqlite.yml up -d
```
