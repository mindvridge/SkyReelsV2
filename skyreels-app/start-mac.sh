#!/bin/bash

# macOS용 SkyReels V2 실행 스크립트

set -e

echo "🚀 SkyReels V2 macOS 실행 스크립트"
echo "=================================="

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"
echo "📁 프로젝트 디렉토리: $(pwd)"

# Docker 설치 확인
echo ""
echo "🔍 Docker 설치 확인 중..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다."
    echo "   Docker Desktop을 설치해주세요: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose가 설치되어 있지 않습니다."
    exit 1
fi

echo "✅ Docker 설치 확인 완료"
echo "   Docker: $(docker --version)"
echo "   Docker Compose: $(docker-compose --version)"

# Docker Desktop 실행 확인
echo ""
echo "🔍 Docker Desktop 실행 확인 중..."
if ! docker ps &> /dev/null; then
    echo "❌ Docker Desktop이 실행되지 않았습니다."
    echo "   Docker Desktop을 실행해주세요."
    exit 1
fi

echo "✅ Docker Desktop 실행 중"

# 포트 사용 확인
echo ""
echo "🔍 포트 사용 확인 중..."
PORTS=(8000 3000 5432 6379)
PORT_IN_USE=false

for port in "${PORTS[@]}"; do
    if lsof -i :$port &> /dev/null; then
        echo "⚠️  포트 $port가 사용 중입니다."
        PORT_IN_USE=true
    fi
done

if [ "$PORT_IN_USE" = true ]; then
    echo ""
    echo "⚠️  일부 포트가 사용 중입니다. 계속 진행하시겠습니까? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "❌ 실행이 취소되었습니다."
        exit 1
    fi
fi

# Docker Compose로 서비스 시작
echo ""
echo "🐳 Docker Compose로 서비스 시작 중..."
echo "   macOS용 설정을 사용합니다 (GPU 없음)"

# Celery worker 제외하고 실행 (비디오 생성 없이 빠른 시작)
echo ""
echo "📝 옵션을 선택하세요:"
echo "   1) 전체 서비스 실행 (백엔드, 프론트엔드, DB, Redis, Celery Worker)"
echo "   2) Celery Worker 제외 실행 (비디오 생성 없음, 빠른 시작)"
echo ""
read -p "선택 (1 또는 2, 기본값: 2): " choice
choice=${choice:-2}

if [ "$choice" = "1" ]; then
    echo "🚀 전체 서비스 시작 중..."
    docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d postgres redis backend frontend
    
    # Celery Worker 수동 시작 (GPU 설정 문제로 인해 수동 실행 필요)
    echo ""
    echo "🔄 Celery Worker 시작 중..."
    # 기존 컨테이너가 있으면 제거
    docker stop skyreels-celery-worker 2>/dev/null || true
    docker rm skyreels-celery-worker 2>/dev/null || true
    
    # Celery Worker를 수동으로 실행 (GPU 설정 없이)
    docker run -d \
      --name skyreels-celery-worker \
      --network skyreels-app_skyreels-network \
      -e DATABASE_URL=postgresql://skyreels:skyreels@postgres:5432/skyreels \
      -e REDIS_URL=redis://redis:6379/0 \
      -e CELERY_BROKER_URL=redis://redis:6379/0 \
      -e CELERY_RESULT_BACKEND=redis://redis:6379/0 \
      -e STORAGE_TYPE=local \
      -e LOCAL_STORAGE_PATH=/app/storage \
      -e SKYREELS_MODEL_CACHE=/models \
      -e DEFAULT_RESOLUTION=540P \
      -e PYTORCH_ENABLE_MPS_FALLBACK=1 \
      -v "$(pwd)/backend:/app" \
      -v skyreels-app_storage_data:/app/storage \
      -v skyreels-app_model_cache:/models \
      skyreels-app-celery-worker \
      celery -A app.services.queue worker --loglevel=info --concurrency=1
    
    echo "✅ Celery Worker가 시작되었습니다."
else
    echo "🚀 Celery Worker 제외하고 시작 중..."
    docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d postgres redis backend frontend
    echo "⚠️  Celery Worker가 시작되지 않았습니다. 비디오 생성 기능을 사용하려면 옵션 1을 선택하세요."
fi

# 서비스 상태 확인
echo ""
echo "⏳ 서비스 시작 대기 중 (30초)..."
sleep 30

# 데이터베이스 초기화
echo ""
echo "🗄️  데이터베이스 초기화 중..."
docker-compose -f docker-compose.yml -f docker-compose.mac.yml exec -T backend python -c "from app.models.database import init_db; init_db()" || echo "⚠️  데이터베이스 초기화 실패 (이미 초기화되었을 수 있습니다)"

# 서비스 상태 확인
echo ""
echo "📊 서비스 상태 확인 중..."
docker-compose -f docker-compose.yml -f docker-compose.mac.yml ps

# Health check
echo ""
echo "🏥 Health check 중..."
if curl -f http://localhost:8000/api/v1/health &> /dev/null; then
    echo "✅ 백엔드 API 정상 작동"
else
    echo "⚠️  백엔드 API 응답 없음 (잠시 후 다시 시도해주세요)"
fi

# 완료 메시지
echo ""
echo "✅ 실행 완료!"
echo ""
echo "📌 접속 URL:"
echo "   - 프론트엔드: http://localhost:3000"
echo "   - 백엔드 API: http://localhost:8000"
echo "   - API 문서: http://localhost:8000/docs"
echo "   - WebSocket 통계: http://localhost:8000/ws/stats"
echo ""
echo "📝 로그 확인:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.mac.yml logs -f"
echo ""
echo "🛑 서비스 중지:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.mac.yml down"
echo ""

