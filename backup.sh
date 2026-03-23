#!/bin/bash
# MRLC GED — SQLite backup script
# Run via cron: 0 2 * * * /path/to/backup.sh
# Keeps last 14 daily backups

BACKUP_DIR="/var/backups/mrlc-ged"
DB_VOLUME="ged-exam-app_sqlite-data"   # docker volume name
DATE=$(date +%Y-%m-%d_%H-%M)
FILE="$BACKUP_DIR/ged-db-$DATE.db"

mkdir -p "$BACKUP_DIR"

# Copy DB out of Docker volume
docker run --rm \
  -v "$DB_VOLUME:/data" \
  -v "$BACKUP_DIR:/backup" \
  alpine sh -c "cp /data/app.db /backup/ged-db-$DATE.db"

if [ $? -eq 0 ]; then
  echo "[$DATE] Backup saved: $FILE"
  # Delete backups older than 14 days
  find "$BACKUP_DIR" -name "*.db" -mtime +14 -delete
  echo "[$DATE] Old backups cleaned."
else
  echo "[$DATE] ERROR: Backup failed!" >&2
fi
