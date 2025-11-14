# 🚀 빠른 시작 가이드 (macOS)

현재 환경에서 SkyReels V2를 실행하기 위한 간단한 가이드입니다.

## ✅ 사전 준비

1. **Docker Desktop 설치 및 실행**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Docker Desktop 리소스 설정**
   - Docker Desktop → Preferences (⌘ + ,) → Resources
   - CPU: 최소 4개
   - Memory: 최소 8GB (권장 16GB)
   - Disk: 50GB+

## 📝 실행 단계

### 방법 1: 자동 실행 스크립트 사용 (권장)

```bash
cd /Users/mindprep/Desktop/VideoMaker/SkyReelsV2/skyreels-app
./start-mac.sh
```

스크립트가 다음을 자동으로 수행합니다:
- Docker 설치 확인
- 포트 사용 확인
- 서비스 시작
- 데이터베이스 초기화
- 상태 확인

### 방법 2: 수동 실행

#### 1단계: 프로젝트 디렉토리로 이동
```bash
cd /Users/mindprep/Desktop/VideoMaker/SkyReelsV2/skyreels-app
```

#### 2단계: Docker Compose로 서비스 시작

**옵션 A: Celery Worker 제외 (빠른 시작, 비디오 생성 불가)**
```bash
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d postgres redis backend frontend
```

**옵션 B: 전체 서비스 실행 (비디오 생성 가능, 매우 느림)**
```bash
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d
```

#### 3단계: 데이터베이스 초기화
```bash
docker-compose -f docker-compose.yml -f docker-compose.mac.yml exec backend python -c "from app.models.database import init_db; init_db()"
```

#### 4단계: 서비스 상태 확인
```bash
docker-compose -f docker-compose.yml -f docker-compose.mac.yml ps
```

#### 5단계: 로그 확인
```bash
docker-compose -f docker-compose.yml -f docker-compose.mac.yml logs -f
```

## 🌐 접속 URL

서비스가 시작되면 다음 URL로 접속할 수 있습니다:

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/v1/health
- **WebSocket 통계**: http://localhost:8000/ws/stats

## 🧪 테스트

### 백엔드 API 테스트
```bash
curl http://localhost:8000/api/v1/health
```

### 프론트엔드 접속 테스트
브라우저에서 http://localhost:3000 접속

## 🛑 서비스 중지

```bash
# 모든 서비스 중지
docker-compose -f docker-compose.yml -f docker-compose.mac.yml down

# 볼륨까지 삭제 (데이터 삭제)
docker-compose -f docker-compose.yml -f docker-compose.mac.yml down -v
```

## ⚠️ 주의사항

1. **GPU 없음**: macOS는 NVIDIA GPU를 지원하지 않으므로 비디오 생성은 CPU로만 실행됩니다 (매우 느림)
2. **개발 목적**: 프론트엔드, 백엔드 API, 데이터베이스, WebSocket 기능 테스트는 정상 작동합니다
3. **실제 비디오 생성**: GPU가 있는 Linux 서버에서 실행하는 것을 권장합니다

## 🔧 문제 해결

### 포트 충돌
```bash
# 포트 사용 확인
lsof -i :8000
lsof -i :3000

# 프로세스 종료
kill -9 <PID>
```

### 서비스 재시작
```bash
docker-compose -f docker-compose.yml -f docker-compose.mac.yml restart
```

### 로그 확인
```bash
# 전체 로그
docker-compose -f docker-compose.yml -f docker-compose.mac.yml logs -f

# 특정 서비스 로그
docker-compose -f docker-compose.yml -f docker-compose.mac.yml logs -f backend
docker-compose -f docker-compose.yml -f docker-compose.mac.yml logs -f frontend
```

### 데이터베이스 재초기화
```bash
# 서비스 중지 및 볼륨 삭제
docker-compose -f docker-compose.yml -f docker-compose.mac.yml down -v

# 서비스 다시 시작
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d postgres redis backend frontend

# 데이터베이스 초기화
docker-compose -f docker-compose.yml -f docker-compose.mac.yml exec backend python -c "from app.models.database import init_db; init_db()"
```

## 📚 추가 문서

- [상세 설치 가이드](./SETUP_GUIDE.md)
- [macOS 설치 가이드](./MACOS_SETUP.md)
- [WebSocket 보안 문서](./WEBSOCKET_SECURITY.md)
- [README](./README.md)

---

**팁**: 개발 중에는 프론트엔드를 로컬에서 실행하고 백엔드만 Docker로 실행하는 것을 권장합니다. 자세한 내용은 [SETUP_GUIDE.md](./SETUP_GUIDE.md)를 참조하세요.

