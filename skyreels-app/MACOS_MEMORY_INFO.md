# macOS 메모리 사용 정보

## 현재 상황

### 메모리 사용 방식

**macOS에서는 GPU VRAM 대신 시스템 RAM을 사용합니다.**

#### 이유:
1. **Docker 컨테이너 제약**: Docker 컨테이너 내부에서는 macOS의 GPU(Metal Performance Shaders)에 직접 접근할 수 없습니다.
2. **CUDA 미지원**: macOS는 NVIDIA GPU를 지원하지 않으므로 CUDA를 사용할 수 없습니다.
3. **CPU 모드 실행**: 따라서 PyTorch가 CPU 모드로 실행되며, 모든 연산이 시스템 RAM에서 수행됩니다.

### 메모리 사용량

#### 모델 크기별 예상 RAM 사용량:

**1.3B 모델:**
- 모델 가중치: ~5-8GB
- 추론 중 메모리: ~10-15GB
- **총 필요 RAM: ~15-20GB**

**14B 모델:**
- 모델 가중치: ~25-30GB
- 추론 중 메모리: ~40-50GB
- **총 필요 RAM: ~50-70GB** (매우 큼!)

### 성능 영향

- **CPU 모드**: GPU 대비 10-100배 느림
- **메모리 사용**: 시스템 RAM을 모두 사용할 수 있음
- **실용성**: 개발/테스트 목적으로만 권장

## Apple Silicon (M1/M2/M3)에서의 GPU 사용

### 이론적으로 가능하지만...

Apple Silicon Mac에서는:
- **Metal Performance Shaders (MPS)**를 사용할 수 있습니다
- 하지만 **Docker 컨테이너 내부에서는 MPS를 사용할 수 없습니다**
- Docker Desktop이 macOS GPU에 직접 접근할 수 없기 때문입니다

### MPS를 사용하려면:

Docker 없이 직접 실행해야 합니다:
1. Python 가상환경에서 직접 실행
2. MPS 지원 PyTorch 설치
3. 컨테이너 밖에서 실행

하지만 현재 프로젝트는 Docker 기반이므로 CPU 모드로만 실행됩니다.

## 권장사항

### macOS에서의 사용:
- ✅ **프론트엔드/백엔드 개발**: 정상 작동
- ✅ **API 테스트**: 정상 작동
- ❌ **실제 비디오 생성**: 매우 느리고 비실용적

### 실제 비디오 생성을 위해서는:
- **Linux 서버 + NVIDIA GPU** 환경 필요
- 최소 **RTX 3090 (24GB VRAM)** 또는 **A100 (80GB VRAM)** 권장

## 메모리 모니터링

현재 사용 중인 메모리를 확인하려면:

```bash
# Docker 컨테이너 메모리 사용량 확인
docker stats skyreels-celery-worker

# 시스템 전체 메모리 사용량
docker stats
```

## 요약

**macOS에서는 GPU VRAM 대신 시스템 RAM을 사용합니다.**
- Docker 컨테이너 제약으로 인해 CPU 모드로만 실행
- 모든 연산이 시스템 RAM에서 수행됨
- 매우 느린 성능 (10-100배 느림)
- 개발/테스트 목적으로만 권장

