#!/bin/bash
# Backup script for SkyReels V2 application

set -e

BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

echo "💾 Creating backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Backing up database..."
docker-compose exec -T postgres pg_dump -U skyreels skyreels > "$BACKUP_DIR/database.sql"
echo "✅ Database backed up"

# Backup storage
echo "Backing up storage..."
if [ -d "storage" ]; then
    tar -czf "$BACKUP_DIR/storage.tar.gz" storage/
    echo "✅ Storage backed up"
else
    echo "⚠️  No storage directory found"
fi

# Backup .env
if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/.env"
    echo "✅ Environment file backed up"
fi

echo ""
echo "✅ Backup complete!"
echo "Location: $BACKUP_DIR"
echo ""
