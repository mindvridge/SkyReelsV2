#!/bin/bash
# Setup script for SkyReels V2 application

set -e

echo "🚀 Setting up SkyReels V2 Application..."

# Check prerequisites
echo "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi
echo "✅ Docker found"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
echo "✅ Docker Compose found"

# Check NVIDIA GPU
if ! command -v nvidia-smi &> /dev/null; then
    echo "⚠️  Warning: nvidia-smi not found. GPU support may not work."
else
    echo "✅ NVIDIA GPU detected"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your settings."
else
    echo "✅ .env file already exists"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p storage models nginx
echo "✅ Directories created"

# Download models (optional)
read -p "Do you want to download SkyReels V2 models now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing Hugging Face CLI..."
    pip install huggingface_hub

    echo "Downloading T2V model (540P)..."
    huggingface-cli download Skywork/SkyReels-V2-T2V-14B-540P --local-dir ./models/t2v-540p

    echo "✅ Model downloaded"
fi

# Build Docker images
echo "Building Docker images..."
docker-compose build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run: docker-compose up -d"
echo "3. Initialize database: docker-compose exec backend python -c 'from app.models.database import init_db; init_db()'"
echo "4. Access the app at http://localhost:3000"
echo ""
