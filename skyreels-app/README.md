# SkyReels V2 - Video Generation Web Application

A full-stack web application for generating AI videos using [SkyReels V2](https://github.com/SkyworkAI/SkyReels-V2), the world's first open-source infinite-length video generation model.

## Features

- **Multiple Generation Modes**:
  - Text-to-Video (T2V)
  - Image-to-Video (I2V)
  - Diffusion Forcing (DF) - Infinite Length

- **Resolutions**: 540P and 720P support
- **Real-time Progress Tracking**: Monitor video generation progress with live updates
- **Video Gallery**: Browse and manage generated videos
- **Asynchronous Processing**: Non-blocking video generation using Celery
- **Responsive UI**: Modern, mobile-friendly interface built with React and Tailwind CSS
- **Storage Options**: Local storage or AWS S3

## Architecture

### Backend
- **FastAPI**: High-performance Python web framework
- **Celery**: Distributed task queue for async processing
- **Redis**: Message broker and result backend
- **PostgreSQL**: Database for metadata storage
- **SQLAlchemy**: ORM for database operations

### Frontend
- **React 18**: UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **React Query**: Data fetching and caching
- **Zustand**: State management
- **Vite**: Fast build tool

### Infrastructure
- **Docker Compose**: Container orchestration
- **Nginx**: Reverse proxy (production)
- **NVIDIA Docker**: GPU support for model inference

## Prerequisites

Before running this application, ensure you have:

1. **Docker & Docker Compose** (v2.0+)
   ```bash
   docker --version
   docker-compose --version
   ```

2. **NVIDIA GPU** with CUDA 12.x support
   ```bash
   nvidia-smi
   ```

3. **nvidia-docker2** for GPU access in containers
   ```bash
   # Install on Ubuntu/Debian
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-docker2
   sudo systemctl restart docker
   ```

4. **System Requirements**:
   - GPU: NVIDIA GPU with 24GB+ VRAM (recommended)
   - RAM: 32GB+ recommended
   - Storage: 50GB+ free space for models and videos

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd skyreels-app
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
# Edit .env with your preferred settings
```

### 3. Download SkyReels V2 Models (First Time Only)

The models will be automatically downloaded on first use, but you can pre-download them:

```bash
# Install Hugging Face CLI
pip install huggingface_hub

# Login (optional, for private models)
huggingface-cli login

# Download models (choose based on your needs)
# T2V - Text to Video
huggingface-cli download Skywork/SkyReels-V2-T2V-14B-540P --local-dir ./models/t2v-540p

# I2V - Image to Video
huggingface-cli download Skywork/SkyReels-V2-I2V-14B-540P --local-dir ./models/i2v-540p

# DF - Diffusion Forcing (Infinite Length)
huggingface-cli download Skywork/SkyReels-V2-DF-14B-540P --local-dir ./models/df-540p
```

### 4. Start the Application

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 5. Initialize Database

```bash
# Run database migrations
docker-compose exec backend python -c "from app.models.database import init_db; init_db()"
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## Development Setup (Without Docker)

### Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://skyreels:skyreels@localhost:5432/skyreels"
export REDIS_URL="redis://localhost:6379/0"
export CELERY_BROKER_URL="redis://localhost:6379/0"
export CELERY_RESULT_BACKEND="redis://localhost:6379/0"

# Run FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, run Celery worker
celery -A app.services.queue worker --loglevel=info
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:8000" > .env

# Run development server
npm run dev
```

## Usage Guide

### 1. Generate a Video

1. Open the application at http://localhost:3000
2. Enter a text prompt describing your desired video
3. Select model type (T2V, I2V, or DF)
4. Choose resolution (540P or 720P)
5. Optionally, expand "Advanced Options" to adjust:
   - Number of frames (97-193)
   - Guidance scale (1-20)
   - Inference steps (10-100)
6. Click "Generate Video"

### 2. Monitor Progress

- The progress tracker will appear showing real-time status
- Progress bar indicates completion percentage
- Status updates every 2 seconds

### 3. View and Download Videos

- Completed videos appear in the gallery
- Click on a video thumbnail to open the player
- Use the download button to save videos locally

### 4. Manage Videos

- Delete unwanted videos using the trash icon
- Filter videos by status in the gallery
- Use pagination to browse through videos

## API Endpoints

### Health Check
```http
GET /api/v1/health
```

### Generate Video
```http
POST /api/v1/videos/generate
Content-Type: application/json

{
  "prompt": "A cat playing piano in a jazz club",
  "model_type": "t2v",
  "resolution": "540P",
  "num_frames": 97,
  "guidance_scale": 6.0,
  "num_inference_steps": 30
}
```

### Get Video Status
```http
GET /api/v1/videos/status/{job_id}
```

### List Videos
```http
GET /api/v1/videos/list?page=1&limit=10
```

### Delete Video
```http
DELETE /api/v1/videos/{job_id}
```

## Configuration

### Model Settings

Edit `.env` to configure model settings:

```env
# Default models
DEFAULT_MODEL_T2V=Skywork/SkyReels-V2-T2V-14B-540P
DEFAULT_MODEL_I2V=Skywork/SkyReels-V2-I2V-14B-540P
DEFAULT_MODEL_DF=Skywork/SkyReels-V2-DF-14B-540P

# Default generation parameters
DEFAULT_NUM_FRAMES=97
DEFAULT_GUIDANCE_SCALE=6.0
DEFAULT_NUM_INFERENCE_STEPS=30
```

### Storage Configuration

#### Local Storage (Default)
```env
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/app/storage
```

#### AWS S3 Storage
```env
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
AWS_REGION=us-east-1
```

## Troubleshooting

### GPU Not Detected

```bash
# Check GPU availability in container
docker-compose exec celery-worker nvidia-smi

# If not working, ensure nvidia-docker2 is installed
sudo apt-get install nvidia-docker2
sudo systemctl restart docker
```

### Out of Memory Errors

- Reduce batch size or use 540P resolution
- Enable model offloading (already enabled by default)
- Reduce number of frames
- Close other GPU applications

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready -U skyreels

# Reinitialize database
docker-compose down -v
docker-compose up -d
```

### Celery Worker Not Processing

```bash
# Check Redis connection
docker-compose exec redis redis-cli ping

# View Celery logs
docker-compose logs celery-worker

# Restart worker
docker-compose restart celery-worker
```

### Frontend Can't Connect to Backend

```bash
# Check backend health
curl http://localhost:8000/api/v1/health

# Check CORS settings in backend/.env
CORS_ORIGINS=["http://localhost:3000"]

# Restart backend
docker-compose restart backend
```

## Performance Optimization

### 1. Model Caching
Models are cached in the `/models` volume. First generation will be slow due to model download.

### 2. Memory Management
- VAE uses float32 for quality
- Transformer uses bfloat16 for efficiency
- Model CPU offloading enabled by default

### 3. Concurrent Processing
Adjust Celery concurrency in `docker-compose.yml`:
```yaml
command: celery -A app.services.queue worker --loglevel=info --concurrency=2
```

### 4. Database Optimization
```sql
-- Add indexes for better query performance
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_status ON videos(status);
```

## Production Deployment

### 1. Use Production Profile

```bash
docker-compose --profile production up -d
```

This starts Nginx as a reverse proxy on port 80.

### 2. Security Considerations

- Set strong database passwords
- Use HTTPS (configure SSL in Nginx)
- Implement rate limiting
- Add authentication/authorization
- Restrict CORS origins
- Use environment-specific secrets

### 3. Monitoring

```bash
# View all logs
docker-compose logs -f

# Monitor specific service
docker-compose logs -f celery-worker

# Check resource usage
docker stats
```

### 4. Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U skyreels skyreels > backup.sql

# Backup storage
tar -czf storage_backup.tar.gz storage/
```

## Project Structure

```
skyreels-app/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities
│   ├── requirements.txt
│   ├── Dockerfile
│   └── celery_worker.py
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API client
│   │   ├── store/         # State management
│   │   └── types/         # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Acknowledgments

- [SkyReels V2](https://github.com/SkyworkAI/SkyReels-V2) - The amazing video generation model
- [Skywork AI](https://www.skywork.ai/) - Model developers
- [Hugging Face Diffusers](https://github.com/huggingface/diffusers) - Model implementation

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## Roadmap

### Phase 1 (Current)
- [x] T2V model support
- [x] 540P resolution
- [x] Local storage
- [x] Basic UI

### Phase 2
- [ ] I2V and DF model support
- [ ] 720P resolution
- [ ] Real-time progress updates via WebSocket
- [ ] Advanced video gallery with filters

### Phase 3
- [ ] S3 storage integration
- [ ] User authentication
- [ ] Preset management
- [ ] Batch processing
- [ ] Video editing features

## FAQ

**Q: How long does video generation take?**
A: Depends on GPU and settings. Typically 2-5 minutes for 97 frames at 540P on an RTX 3090.

**Q: Can I run this without a GPU?**
A: Technically yes, but it will be extremely slow (hours instead of minutes). GPU is highly recommended.

**Q: What's the difference between T2V, I2V, and DF?**
A:
- T2V: Generate video from text description
- I2V: Generate video from an input image
- DF: Generate infinite-length videos using diffusion forcing

**Q: How much VRAM do I need?**
A: Minimum 16GB, recommended 24GB+ for 540P. 720P requires more.

**Q: Can I use multiple GPUs?**
A: Currently supports single GPU. Multi-GPU support planned for future releases.

---

Built with ❤️ using SkyReels V2
