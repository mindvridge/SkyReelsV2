#!/bin/bash

# SkyReels V2 macOS 실행 스크립트

echo "🚀 SkyReels V2 실행 시작"
echo "========================"

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")"
echo "📁 현재 디렉토리: $(pwd)"

# Docker Desktop 확인
echo ""
echo "🔍 Docker Desktop 확인 중..."
if ! docker ps &> /dev/null; then
    echo "❌ Docker Desktop이 실행되지 않았습니다."
    echo "   Docker Desktop을 실행해주세요."
    echo "   Applications → Docker 실행"
    exit 1
fi

echo "✅ Docker Desktop 실행 중"

# 포트 확인
echo ""
echo "🔍 포트 사용 확인 중..."
PORTS=(8000 3000 5432 6379)
for port in "${PORTS[@]}"; do
    if lsof -i :$port &> /dev/null; then
        echo "⚠️  포트 $port가 사용 중입니다."
    fi
done

# 서비스 시작 (Celery Worker 제외)
echo ""
echo "🐳 Docker Compose로 서비스 시작 중..."
echo "   (Celery Worker 제외 - 빠른 시작)"
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d postgres redis backend frontend

# 서비스 시작 대기
echo ""
echo "⏳ 서비스 시작 대기 중 (30초)..."
sleep 30

# 데이터베이스 초기화
echo ""
echo "🗄️  데이터베이스 초기화 중..."
docker-compose -f docker-compose.yml -f docker-compose.mac.yml exec -T backend python -c "from app.models.database import init_db; init_db()" 2>&1 || echo "⚠️  데이터베이스 초기화 실패 (이미 초기화되었을 수 있습니다)"

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
echo ""
echo "📝 로그 확인:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.mac.yml logs -f"
echo ""


