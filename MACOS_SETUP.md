# macOS 설치 및 실행 가이드

SkyReels V2 애플리케이션을 macOS에서 실행하기 위한 완전한 가이드입니다.

## ⚠️ 중요: macOS 제약사항

### GPU 지원 불가
- **NVIDIA GPU**: macOS는 NVIDIA GPU를 지원하지 않음
- **CUDA**: macOS에서 CUDA 사용 불가
- **Apple Silicon (M1/M2/M3)**: 현재 PyTorch MPS는 제한적 지원
- **Intel Mac**: NVIDIA GPU 드라이버 없음

### 성능 영향
- **CPU만 사용**: 비디오 생성이 매우 느림 (10-100배 느림)
- **실용성**: 개발/테스트 목적으로만 권장
- **프로덕션**: Linux + NVIDIA GPU 환경 필수

## 🎯 권장 사용 방법

macOS에서는 다음 목적으로만 사용을 권장합니다:

1. ✅ **프론트엔드 개발**: UI/UX 작업
2. ✅ **백엔드 API 개발**: API 엔드포인트 작업
3. ✅ **데이터베이스 스키마 작업**: 데이터 모델 개발
4. ✅ **WebSocket 기능 테스트**: 실시간 통신 테스트
5. ❌ **실제 비디오 생성**: GPU 없이는 비실용적

## 📋 필수 요구사항

### 1. Docker Desktop for Mac
```bash
# Homebrew로 설치
brew install --cask docker

# 또는 공식 사이트에서 다운로드
# https://www.docker.com/products/docker-desktop/

# 설치 확인
docker --version
docker-compose --version
```

### 2. 시스템 요구사항
- **macOS**: 11 (Big Sur) 이상
- **RAM**: 최소 16GB, 권장 32GB+
- **저장공간**: 50GB+ 여유 공간
- **프로세서**:
  - Intel: Core i7 이상
  - Apple Silicon: M1/M2/M3

### 3. Docker Desktop 설정

Docker Desktop 설정에서 리소스 할당:

1. Docker Desktop 열기
2. **Preferences** (⌘ + ,) → **Resources**
3. 다음과 같이 설정:
   - **CPUs**: 최소 4개 (가능하면 더 많이)
   - **Memory**: 최소 8GB, 권장 16GB
   - **Swap**: 2GB
   - **Disk**: 50GB+

4. **Apply & Restart** 클릭

## 🚀 설치 및 실행

### 1. 저장소 클론

```bash
git clone <repository-url>
cd SkyReelsV2/skyreels-app
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집 (선택사항)
# macOS에서는 기본 설정으로 충분합니다
```

### 3. macOS용 Docker Compose로 실행

**방법 1: macOS 오버라이드 사용** (권장)

```bash
# GPU 설정 없이 실행
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d

# 로그 확인
docker-compose logs -f
```

**방법 2: 프로필별 실행**

```bash
# 프론트엔드 + 백엔드만 (GPU worker 제외)
docker-compose up -d postgres redis backend frontend

# Celery worker는 제외 (비디오 생성 불가하지만 빠름)
```

### 4. 데이터베이스 초기화

```bash
# 데이터베이스 초기화
docker-compose exec backend python -c "from app.models.database import init_db; init_db()"
```

### 5. 애플리케이션 접속

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs
- **WebSocket 통계**: http://localhost:8000/ws/stats

## 🧪 테스트 가능한 기능

### ✅ 완전히 작동하는 기능

1. **프론트엔드 UI**
   - 모든 컴포넌트 렌더링
   - 반응형 디자인
   - 라우팅 및 네비게이션

2. **백엔드 API**
   - 모든 REST API 엔드포인트
   - 데이터베이스 CRUD 작업
   - 파일 업로드/다운로드

3. **WebSocket**
   - 실시간 연결
   - 메시지 브로드캐스팅
   - 보안 기능 (origin 검증, rate limiting)

4. **데이터베이스**
   - PostgreSQL 완전 작동
   - 마이그레이션
   - 쿼리 최적화

5. **Redis & Celery**
   - Redis 캐싱
   - Celery 태스크 큐
   - 비동기 작업 관리

### ⚠️ 제한적으로 작동하는 기능

1. **비디오 생성**
   - CPU로만 실행 (매우 느림)
   - 테스트 목적으로만 사용 가능
   - 타임아웃 가능성 높음

## 💻 로컬 개발 (Docker 없이)

프론트엔드 또는 백엔드만 개발하는 경우:

### 프론트엔드만 실행

```bash
cd frontend

# 의존성 설치
npm install

# 환경 변수 설정
cat > .env << EOF
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
EOF

# 개발 서버 시작
npm run dev

# 브라우저에서 http://localhost:5173 접속
```

### 백엔드만 실행

```bash
# Docker로 DB와 Redis만 실행
docker-compose up -d postgres redis

cd backend

# Python 가상환경 생성
python3 -m venv venv
source venv/bin/activate

# 의존성 설치 (시간 소요)
pip install --upgrade pip
pip install -r requirements.txt

# 환경 변수 설정
export DATABASE_URL="postgresql://skyreels:skyreels@localhost:5432/skyreels"
export REDIS_URL="redis://localhost:6379/0"
export CELERY_BROKER_URL="redis://localhost:6379/0"
export CELERY_RESULT_BACKEND="redis://localhost:6379/0"

# FastAPI 서버 시작
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# API 문서: http://localhost:8000/docs
```

## 🔍 문제 해결

### Docker Desktop이 느림

```bash
# Docker Desktop 리소스 증가
# Preferences → Resources에서 CPU와 메모리 증가

# Docker 캐시 정리
docker system prune -a
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :8000  # 백엔드
lsof -i :3000  # 프론트엔드
lsof -i :5432  # PostgreSQL

# 프로세스 종료
kill -9 <PID>
```

### M1/M2/M3 Mac에서 Docker 이미지 빌드 오류

```bash
# Rosetta 2 설치 (Intel 에뮬레이션)
softwareupdate --install-rosetta

# Docker Desktop 설정
# Settings → General → "Use Rosetta for x86/amd64 emulation" 체크

# 플랫폼 지정하여 빌드
docker-compose build --build-arg BUILDPLATFORM=linux/amd64
```

### Python 패키지 설치 오류

일부 패키지(특히 `flash-attn`)는 macOS에서 설치가 어려울 수 있습니다:

```bash
# flash-attn 없이 설치
pip install -r requirements.txt --no-deps
pip install flash-attn || echo "flash-attn 스킵됨"

# 또는 requirements.txt에서 flash-attn 제거
grep -v "flash-attn" requirements.txt > requirements.mac.txt
pip install -r requirements.mac.txt
```

### 메모리 부족

```bash
# Docker Desktop 메모리 증가
# Preferences → Resources → Memory를 16GB로 증가

# 또는 swap 증가
# Preferences → Resources → Swap을 4GB로 증가
```

## 🎨 macOS에서 권장 개발 워크플로우

### 시나리오 1: 프론트엔드 개발자

```bash
# 백엔드는 Docker로 실행
docker-compose up -d postgres redis backend

# 프론트엔드는 로컬에서 실행 (Hot Reload)
cd frontend && npm run dev
```

### 시나리오 2: 백엔드 개발자

```bash
# DB만 Docker로 실행
docker-compose up -d postgres redis

# 백엔드는 로컬에서 실행 (Hot Reload)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### 시나리오 3: 풀스택 개발자

```bash
# 모두 Docker로 실행 (편리함)
docker-compose -f docker-compose.yml -f docker-compose.mac.yml up -d

# 코드 변경 시 자동 재시작 (volume mount 덕분)
```

## ⚡ 성능 최적화 팁

### 1. Docker Desktop 최적화

```bash
# Docker Desktop → Preferences → Resources
# - CPUs: 최대치의 75%
# - Memory: 시스템 RAM의 50%
# - Enable VirtioFS (faster file sharing)
```

### 2. 불필요한 서비스 비활성화

```bash
# Celery worker 제외 (비디오 생성 안 함)
docker-compose up -d postgres redis backend frontend

# Nginx도 제외 (개발 시 불필요)
```

### 3. Volume 대신 Bind Mount 사용

이미 설정되어 있지만, 개발 시 코드 변경이 즉시 반영됩니다.

## 🚀 프로덕션 환경 권장사항

macOS는 개발 환경으로만 사용하고, 프로덕션은:

### 클라우드 GPU 인스턴스

1. **AWS EC2 (P3/P4 인스턴스)**
   - p3.2xlarge (NVIDIA V100, 1 GPU)
   - p4d.24xlarge (NVIDIA A100, 8 GPUs)

2. **Google Cloud Platform**
   - n1-standard-8 + NVIDIA T4/V100

3. **Azure**
   - NC-series (NVIDIA GPU)

### Docker Compose로 간편 배포

```bash
# Linux 서버에서
git clone <repository-url>
cd skyreels-app

# GPU 있는 일반 docker-compose 사용
docker-compose up -d

# 완전히 작동하는 비디오 생성!
```

## 🔧 대안: Remote Development

### VSCode Remote - SSH

```bash
# 로컬 macOS에서 원격 Linux GPU 서버에 연결
# VSCode에서 Remote-SSH 확장 설치
# 원격 서버에서 개발하면서 macOS에서 편집
```

### Docker Context

```bash
# 로컬 Docker 명령을 원격 서버에서 실행
docker context create remote --docker "host=ssh://user@remote-server"
docker context use remote
docker-compose up -d  # 원격 서버에서 실행됨!
```

## 📚 추가 리소스

- [Docker Desktop for Mac 문서](https://docs.docker.com/desktop/mac/)
- [Apple Silicon Docker 가이드](https://docs.docker.com/desktop/mac/apple-silicon/)
- [SkyReels V2 GitHub](https://github.com/SkyworkAI/SkyReels-V2)

## 💡 요약

### ✅ macOS에서 할 수 있는 것
- 전체 애플리케이션 개발
- UI/UX 작업
- API 개발 및 테스트
- 데이터베이스 작업
- WebSocket 기능 테스트

### ❌ macOS에서 할 수 없는 것
- 실용적인 비디오 생성 (GPU 필요)
- 프로덕션 수준 성능

### 🎯 권장 사항
- **개발**: macOS 사용 가능
- **테스트**: 가벼운 테스트만 가능
- **프로덕션**: Linux + NVIDIA GPU 필수

---

macOS에서 개발하고, 실제 비디오 생성은 Linux GPU 서버에서 실행하는 하이브리드 접근을 권장합니다! 🚀
