# Runpod용 SkyReels V2 Dockerfile
# GPU가 있는 Runpod 인스턴스에서 실행하기 위한 올인원 컨테이너

FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

# 환경 변수 설정
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHON_VERSION=3.10 \
    NODE_VERSION=20 \
    CUDA_HOME=/usr/local/cuda \
    PATH=/usr/local/cuda/bin:$PATH \
    LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH

# 기본 패키지 설치
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3-pip \
    git \
    wget \
    curl \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    vim \
    nano \
    htop \
    tmux \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Python 심볼릭 링크
RUN ln -sf /usr/bin/python3.10 /usr/bin/python && \
    ln -sf /usr/bin/python3.10 /usr/bin/python3

# pip 업그레이드
RUN python -m pip install --upgrade pip setuptools wheel

# Node.js 설치
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

# 작업 디렉토리 설정
WORKDIR /workspace/SkyReelsV2

# 백엔드 의존성 파일 복사 및 설치
COPY backend/requirements.txt /workspace/SkyReelsV2/backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# PyTorch 재설치 (CUDA 11.8용)
RUN pip install --no-cache-dir --force-reinstall \
    torch==2.1.0 \
    torchvision==0.16.0 \
    torchaudio==2.1.0 \
    --index-url https://download.pytorch.org/whl/cu118

# 프론트엔드 의존성 설치
COPY frontend/package*.json /workspace/SkyReelsV2/frontend/
WORKDIR /workspace/SkyReelsV2/frontend
RUN npm ci

# 전체 프로젝트 복사
WORKDIR /workspace/SkyReelsV2
COPY . .

# 프론트엔드 빌드
WORKDIR /workspace/SkyReelsV2/frontend
RUN npm run build

# 백엔드로 다시 이동
WORKDIR /workspace/SkyReelsV2/backend

# 필요한 디렉토리 생성
RUN mkdir -p /workspace/SkyReelsV2/backend/generated_videos \
    /workspace/SkyReelsV2/backend/models \
    /workspace/SkyReelsV2/backend/logs

# Runpod 스크립트 실행 권한 부여
RUN chmod +x /workspace/SkyReelsV2/runpod/*.sh

# 포트 노출
EXPOSE 8000 5173

# 시작 스크립트 실행
CMD ["/workspace/SkyReelsV2/runpod/start.sh"]
