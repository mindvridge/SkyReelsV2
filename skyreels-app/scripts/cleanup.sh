#!/bin/bash
# Cleanup script for SkyReels V2 application

set -e

echo "🧹 Cleaning up SkyReels V2 Application..."

# Stop containers
echo "Stopping containers..."
docker-compose down

# Ask if user wants to remove volumes
read -p "Do you want to remove volumes (database, storage)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing volumes..."
    docker-compose down -v
    echo "✅ Volumes removed"
fi

# Ask if user wants to remove images
read -p "Do you want to remove Docker images? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing images..."
    docker-compose down --rmi all
    echo "✅ Images removed"
fi

echo "✅ Cleanup complete!"
