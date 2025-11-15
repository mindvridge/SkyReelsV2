# 🚀 SkyReels V2 - Runpod 사용 가이드

Runpod 클라우드 GPU에서 SkyReels V2를 실행하기 위한 완벽한 가이드입니다.

## 📋 목차

1. [Runpod 인스턴스 선택](#runpod-인스턴스-선택)
2. [빠른 시작 (권장)](#빠른-시작-권장)
3. [수동 설치](#수동-설치)
4. [Docker 이미지로 실행](#docker-이미지로-실행)
5. [사용 방법](#사용-방법)
6. [문제 해결](#문제-해결)
7. [비용 최적화](#비용-최적화)

---

## 🖥️ Runpod 인스턴스 선택

### 권장 GPU 사양

| 모델 크기 | 최소 VRAM | 권장 GPU | 예상 비용/시간 |
|-----------|-----------|----------|----------------|
| 6B (540P) | 12GB | RTX 3090 (24GB) | $0.34/hr |
| 6B (720P) | 16GB | RTX 4090 (24GB) | $0.69/hr |
| 14B (540P) | 24GB | RTX 4090 (24GB) | $0.69/hr |
| 14B (720P) | 32GB+ | A100 (40GB/80GB) | $1.89/hr ~ $2.89/hr |

### 권장 인스턴스 설정

**초보자용 (6B 모델)**:
- GPU: RTX 3090 (24GB)
- vCPU: 8 cores
- RAM: 32GB
- Storage: 100GB
- 비용: ~$0.34/hr

**고품질 (14B 모델)**:
- GPU: RTX 4090 (24GB) 또는 A100 (40GB)
- vCPU: 16 cores
- RAM: 64GB
- Storage: 200GB
- 비용: ~$0.69-1.89/hr

---

## ⚡ 빠른 시작 (권장)

### 방법 1: GitHub에서 직접 클론

1. **Runpod 인스턴스 생성**
   - Runpod.io 로그인
   - "Deploy" → "Pods" → "Deploy"
   - Template: `RunPod PyTorch 2.1` 선택
   - GPU 선택 (위 권장 사양 참고)
   - Volume: 100GB 이상 (Persistent 권장)

2. **터미널 접속**
   ```bash
   # Runpod 대시보드에서 "Connect" → "Start Web Terminal"
   ```

3. **프로젝트 클론**
   ```bash
   cd /workspace
   git clone https://github.com/mindvridge/SkyReelsV2.git
   cd SkyReelsV2
   ```

4. **초기 설정 실행**
   ```bash
   bash runpod/setup.sh
   ```

   이 스크립트는 다음을 자동으로 수행합니다:
   - GPU 및 CUDA 확인
   - Python 패키지 설치
   - Node.js 패키지 설치
   - 데이터베이스 초기화
   - 환경 변수 설정

5. **서비스 시작**
   ```bash
   bash runpod/start.sh
   ```

6. **접속**
   - Runpod 대시보드에서 "Connect" 버튼 클릭
   - "HTTP Service [포트번호]" 링크 클릭
   - 포트 5173: 프론트엔드 UI
   - 포트 8000: 백엔드 API

---

## 🛠️ 수동 설치

자동 스크립트를 사용하지 않고 수동으로 설치하려면:

### 1. 시스템 업데이트

```bash
apt-get update && apt-get upgrade -y
apt-get install -y git wget curl ffmpeg vim htop
```

### 2. Python 설정

```bash
# Python 3.10 확인
python --version

# pip 업그레이드
python -m pip install --upgrade pip
```

### 3. 프로젝트 클론 및 설정

```bash
cd /workspace
git clone https://github.com/mindvridge/SkyReelsV2.git
cd SkyReelsV2
```

### 4. 백엔드 설정

```bash
cd backend

# 패키지 설치
pip install -r requirements.txt

# PyTorch CUDA 재설치 (필요시)
pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 \
    --index-url https://download.pytorch.org/whl/cu118

# 데이터베이스 초기화
python -c "from app.database import init_db; init_db()"
```

### 5. 프론트엔드 설정

```bash
cd ../frontend

# Node.js 20 설치 (없을 경우)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 패키지 설치
npm install

# 빌드 (프로덕션용)
npm run build
```

### 6. 환경 변수 설정

```bash
cd /workspace/SkyReelsV2
cp runpod/.env.runpod .env

# 필요시 .env 파일 수정
nano .env
```

### 7. 서비스 시작

```bash
# 백엔드 시작
cd backend
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/backend.log 2>&1 &

# 프론트엔드 시작
cd ../frontend
nohup npm run dev -- --host 0.0.0.0 --port 5173 > logs/frontend.log 2>&1 &
```

---

## 🐳 Docker 이미지로 실행

### 1. Docker 이미지 빌드

```bash
cd /workspace/SkyReelsV2
docker build -f runpod/Dockerfile -t skyreels-v2:runpod .
```

### 2. 컨테이너 실행

```bash
docker run -d \
  --gpus all \
  -p 8000:8000 \
  -p 5173:5173 \
  -v /workspace/models:/workspace/SkyReelsV2/backend/models \
  -v /workspace/videos:/workspace/SkyReelsV2/backend/generated_videos \
  --name skyreels \
  skyreels-v2:runpod
```

### 3. 로그 확인

```bash
docker logs -f skyreels
```

---

## 📖 사용 방법

### 1. UI 접속

1. Runpod 대시보드에서 Pod 선택
2. "Connect" 버튼 클릭
3. "HTTP Service" 섹션에서 포트 번호 확인
4. 포트 5173 링크 클릭 (프론트엔드)

### 2. API 직접 사용

```bash
# API 문서 접속 (Runpod URL)
https://[your-pod-id]-8000.proxy.runpod.net/docs

# 예시: 비디오 생성
curl -X POST "https://[your-pod-id]-8000.proxy.runpod.net/api/v1/videos/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cat playing piano in a jazz club",
    "model_type": "t2v",
    "model_size": "6B",
    "resolution": "720P",
    "num_frames": 121,
    "guidance_scale": 7.0,
    "num_inference_steps": 50
  }'
```

### 3. 로그 모니터링

```bash
# 백엔드 로그
tail -f /workspace/SkyReelsV2/backend/logs/backend.log

# 프론트엔드 로그
tail -f /workspace/SkyReelsV2/backend/logs/frontend.log

# GPU 사용량 모니터링
watch -n 1 nvidia-smi
```

### 4. 생성된 비디오 다운로드

```bash
# 생성된 비디오 목록
ls -lah /workspace/SkyReelsV2/backend/generated_videos/

# Runpod 파일 브라우저에서 다운로드
# 대시보드 → "Connect" → "File Browser"
```

---

## 🔧 문제 해결

### GPU를 인식하지 못하는 경우

```bash
# GPU 확인
nvidia-smi

# PyTorch CUDA 확인
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.device_count())"

# CUDA가 False인 경우 PyTorch 재설치
pip uninstall torch torchvision torchaudio -y
pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 \
    --index-url https://download.pytorch.org/whl/cu118
```

### Out of Memory (OOM) 에러

```bash
# 1. 더 작은 모델 사용
# .env 파일 수정
DEFAULT_MODEL_SIZE=6B  # 14B 대신

# 2. 해상도 낮추기
DEFAULT_RESOLUTION=540P  # 720P 대신

# 3. 프레임 수 줄이기
DEFAULT_NUM_FRAMES=97  # 121 대신

# 4. Inference steps 줄이기
DEFAULT_NUM_INFERENCE_STEPS=30  # 50 대신

# 5. GPU 메모리 정리
python -c "import torch; torch.cuda.empty_cache()"
```

### 모델 다운로드 느린 경우

```bash
# 1. Hugging Face 미러 사용 (중국/아시아)
export HF_ENDPOINT=https://hf-mirror.com

# 2. 또는 모델을 로컬에 미리 다운로드
cd /workspace/SkyReelsV2/backend
python -c "
from diffusers import DiffusionPipeline
pipeline = DiffusionPipeline.from_pretrained(
    'huggingface-model-name',
    cache_dir='./models'
)
"
```

### 포트 접속 안 되는 경우

```bash
# 1. 서비스 실행 확인
ps aux | grep uvicorn
ps aux | grep vite

# 2. 포트 리스닝 확인
netstat -tuln | grep 8000
netstat -tuln | grep 5173

# 3. 방화벽 확인 (Runpod는 기본적으로 열려있음)
# Runpod 대시보드에서 "Expose HTTP Ports" 확인
```

### 서비스 재시작

```bash
# 중지
bash /workspace/SkyReelsV2/runpod/stop.sh

# 시작
bash /workspace/SkyReelsV2/runpod/start.sh
```

---

## 💰 비용 최적화

### 1. Auto-pause 설정

Runpod 대시보드에서:
- Pod 설정 → "Auto-pause" 활성화
- 유휴 시간 설정 (예: 30분)
- 사용하지 않을 때 자동으로 일시 정지

### 2. Spot 인스턴스 사용

- "Community Cloud" → "Spot" 인스턴스 선택
- 최대 70% 할인
- 단, 언제든지 중단될 수 있음 (긴급하지 않은 작업에 적합)

### 3. Volume 공유

```bash
# Persistent Volume에 모델 저장
# 여러 Pod에서 재사용 가능
/workspace/models  # 모델 캐시
/workspace/videos  # 생성된 비디오

# Pod 삭제 후 재생성 시에도 모델 재다운로드 불필요
```

### 4. 배치 처리

```bash
# 여러 비디오를 한 번에 생성
# 예시: videos.txt에 프롬프트 목록 작성
cat videos.txt | while read prompt; do
  curl -X POST "http://localhost:8000/api/v1/videos/generate" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": \"$prompt\", ...}"
done

# 모든 생성 완료 후 Pod 종료
```

### 5. 최소 사양 사용

```bash
# 테스트용 최소 사양
- GPU: RTX 3060 (12GB) - $0.24/hr
- Resolution: 540P
- Model: 6B
- Inference Steps: 30

# 고품질 필요 시에만 업그레이드
```

---

## 📊 성능 벤치마크 (Runpod)

### RTX 3090 (24GB) - $0.34/hr

| 설정 | 생성 시간 | 품질 |
|------|----------|------|
| 6B, 540P, 30 steps | ~2분 | 좋음 |
| 6B, 720P, 50 steps | ~4분 | 매우 좋음 |
| 6B, 720P, 100 steps | ~7분 | 최고 |

### RTX 4090 (24GB) - $0.69/hr

| 설정 | 생성 시간 | 품질 |
|------|----------|------|
| 6B, 720P, 50 steps | ~2분 | 매우 좋음 |
| 14B, 540P, 50 steps | ~3.5분 | 최고 |
| 14B, 720P, 50 steps | ~5분 | 프로페셔널 |

### A100 (40GB) - $1.89/hr

| 설정 | 생성 시간 | 품질 |
|------|----------|------|
| 14B, 720P, 50 steps | ~3분 | 프로페셔널 |
| 14B, 720P, 100 steps | ~5분 | 최고 품질 |
| 14B, 720P, 200 steps | ~10분 | 영화급 |

---

## 🎯 프로덕션 체크리스트

배포 전 확인사항:

- [ ] GPU 메모리 충분 (최소 12GB, 권장 24GB)
- [ ] 디스크 공간 충분 (최소 100GB)
- [ ] 환경 변수 설정 완료 (.env)
- [ ] 데이터베이스 초기화 완료
- [ ] 모델 다운로드 완료 (첫 실행 시 자동)
- [ ] 포트 접속 테스트 완료 (8000, 5173)
- [ ] GPU 모니터링 설정 (nvidia-smi)
- [ ] 로그 모니터링 설정
- [ ] Auto-pause 설정 (비용 절감)
- [ ] Persistent Volume 연결 (모델 재사용)

---

## 📞 추가 도움말

### 커뮤니티

- GitHub Issues: https://github.com/mindvridge/SkyReelsV2/issues
- Runpod Discord: https://discord.gg/runpod

### 유용한 명령어

```bash
# 전체 시스템 상태 확인
bash /workspace/SkyReelsV2/runpod/check_status.sh

# GPU 메모리 사용량 실시간 모니터링
watch -n 1 nvidia-smi

# 디스크 사용량 확인
df -h

# 프로세스 모니터링
htop

# 네트워크 연결 확인
netstat -tuln
```

---

## 🚀 다음 단계

1. **모델 미세조정**: 특정 스타일로 학습
2. **API 통합**: 외부 서비스와 연동
3. **자동화**: 배치 처리 스크립트 작성
4. **모니터링**: Grafana + Prometheus 설정

---

**즐거운 비디오 생성 되세요!** 🎬✨
