# macOS 실행 가이드

현재 환경(macOS)에서 SkyReels V2 애플리케이션을 실행하기 위한 단계별 가이드입니다.

## ⚠️ 중요 사항

- **GPU 미지원**: macOS는 NVIDIA GPU를 지원하지 않으므로 비디오 생성은 CPU로만 실행됩니다 (매우 느림)
- **개발 목적**: 프론트엔드, 백엔드 API, 데이터베이스, WebSocket 기능 테스트는 정상 작동합니다
- **실제 비디오 생성**: GPU가 있는 Linux 서버에서 실행하는 것을 권장합니다

## 📋 사전 요구사항

### 1. Docker Desktop 설치 확인

```bash
# Docker 버전 확인
docker --version
docker-compose --version

# Docker Desktop이 실행 중인지 확인
docker ps
```

Docker Desktop이 설치되어 있지 않다면:
- [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) 다운로드 및 설치
- Homebrew로 설치: `brew install --cask docker`

### 2. 시스템 리소스 확인

Docker Desktop 설정에서 다음 리소스 할당:
- **CPU**: 최소 4개 코어
- **Memory**: 최소 8GB, 권장 16GB
- **Disk**: 50GB+ 여유 공간

Docker Desktop → Preferences (⌘ + ,) → Resources에서 설정

## 🚀 실행 단계

### 1단계: 프로젝트 디렉토리로 이동

```bash
cd /Users/mindprep/Desktop/VideoMaker/SkyReelsV2/skyreels-app
```

### 2단계: 필요한 포트 확인

다음 포트가 사용 중이 아닌지 확인:
- `8000`: 백엔드 API
- `3000`: 프론트엔드
- `5432`: PostgreSQL
- `6379`: Redis

```bash
# 포트 사용 확인
lsof -i :8000
lsof -i :3000
lsof -i :5432
lsof -i :6379

# 포트가 사용 중이면 프로세스 종료
kill -9 <PID>
```

### 3단계: 백엔드 Dockerfile 수정 (macOS용)

**중요**: 기본 Dockerfile이 NVIDIA CUDA 이미지를 사용하므로 macOS에서는 CPU용으로 수정해야 합니다.

백엔드 Dockerfile을 다음과 같이 수정:

```dockerfile
# macOS용 CPU 전용 Dockerfile
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies (CPU 버전)
RUN pip3 install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip3 install --no-cache-dir -r requirements.txt || pip3 install --no-cache-dir -r requirements.txt --no-deps

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/storage /models

# Expose port
EXPOSE 8000

# Default command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4단계: Docker Compose로 서비스 실행

macOS용 오버라이드 설정을 사용하여 실행:

```bash
# 모든 서비스 실행 (프론트엔드 + 백엔드 + DB + Redis)
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d

# 또는 Celery worker 제외하고 실행 (비디오 생성 없이 빠른 시작)
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d postgres redis backend frontend
```

### 5단계: 로그 확인

```bash
# 모든 서비스 로그 확인
docker-compose logs -f

# 특정 서비스 로그 확인
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### 6단계: 데이터베이스 초기화

```bash
# 데이터베이스 초기화
docker-compose exec backend python -c "from app.models.database import init_db; init_db()"
```

### 7단계: 서비스 상태 확인

```bash
# 실행 중인 컨테이너 확인
docker-compose ps

# 백엔드 health check
curl http://localhost:8000/api/v1/health

# 프론트엔드 접속 확인
curl http://localhost:3000
```

### 8단계: 애플리케이션 접속

브라우저에서 다음 URL로 접속:

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs
- **WebSocket 통계**: http://localhost:8000/ws/stats

## 🧪 테스트 가능한 기능

### ✅ 정상 작동하는 기능

1. **프론트엔드 UI**
   - 모든 컴포넌트 렌더링
   - 폼 입력 및 검증
   - 비디오 갤러리
   - 설정 관리

2. **백엔드 API**
   - REST API 엔드포인트
   - 데이터베이스 CRUD 작업
   - 파일 업로드/다운로드
   - WebSocket 연결

3. **데이터베이스**
   - PostgreSQL 완전 작동
   - 데이터 저장 및 조회
   - 마이그레이션

4. **WebSocket**
   - 실시간 연결
   - 메시지 브로드캐스팅
   - 보안 기능

### ⚠️ 제한적으로 작동하는 기능

1. **비디오 생성**
   - CPU로만 실행 (매우 느림)
   - 테스트 목적으로만 사용 가능
   - 타임아웃 가능성 높음

## 🔧 문제 해결

### Docker 이미지 빌드 오류

백엔드 Dockerfile이 CUDA 이미지를 사용하는 경우:

```bash
# Dockerfile을 CPU용으로 수정 후 재빌드
docker-compose -f docker-compose.yml -f docker-compose.mac.yml build --no-cache backend
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :8000
lsof -i :3000

# 프로세스 종료
kill -9 <PID>
```

### 데이터베이스 연결 오류

```bash
# PostgreSQL 상태 확인
docker-compose exec postgres pg_isready -U skyreels

# 데이터베이스 재시작
docker-compose restart postgres
```

### 메모리 부족

Docker Desktop 설정에서 메모리 증가:
- Preferences → Resources → Memory를 16GB로 증가

### 컨테이너 재시작

```bash
# 모든 서비스 재시작
docker-compose restart

# 특정 서비스 재시작
docker-compose restart backend
```

## 🛑 서비스 중지

```bash
# 모든 서비스 중지
docker-compose -f docker-compose.yml -f docker-compose.mac.yml down

# 볼륨까지 삭제 (데이터 삭제)
docker-compose -f docker-compose.yml -f docker-compose.mac.yml down -v
```

## 📚 추가 리소스

- [macOS 설치 가이드](./MACOS_SETUP.md)
- [WebSocket 보안 문서](./WEBSOCKET_SECURITY.md)
- [README](./README.md)

## 💡 팁

1. **개발 워크플로우**: 프론트엔드는 로컬에서 실행하고 백엔드는 Docker로 실행하는 것을 권장
2. **로그 모니터링**: `docker-compose logs -f`로 실시간 로그 확인
3. **리소스 모니터링**: Docker Desktop에서 리소스 사용량 확인

---

**참고**: macOS에서는 개발/테스트 목적으로만 사용하고, 실제 비디오 생성은 GPU가 있는 Linux 서버에서 실행하는 것을 권장합니다.

