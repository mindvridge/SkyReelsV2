#!/bin/bash

# SkyReels V2 Runpod 상태 확인 스크립트

echo "========================================"
echo "  SkyReels V2 시스템 상태"
echo "========================================"
echo ""

# 색상 코드
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

WORKSPACE="/workspace/SkyReelsV2"

# 1. GPU 상태
echo -e "${BLUE}[GPU 상태]${NC}"
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total --format=csv,noheader
    echo ""
else
    echo -e "${RED}✗ nvidia-smi를 찾을 수 없습니다${NC}"
fi

# 2. CUDA 상태
echo -e "${BLUE}[CUDA 상태]${NC}"
if python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'CUDA Version: {torch.version.cuda}'); print(f'GPU Count: {torch.cuda.device_count()}')" 2>/dev/null; then
    echo -e "${GREEN}✓ PyTorch CUDA 정상${NC}"
else
    echo -e "${RED}✗ PyTorch CUDA 문제 발생${NC}"
fi
echo ""

# 3. 서비스 상태
echo -e "${BLUE}[서비스 상태]${NC}"

# 백엔드
if ps aux | grep -v grep | grep "uvicorn app.main:app" > /dev/null; then
    BACKEND_PID=$(ps aux | grep -v grep | grep "uvicorn app.main:app" | awk '{print $2}')
    echo -e "${GREEN}✓ 백엔드 실행 중 (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}✗ 백엔드 중지됨${NC}"
fi

# 프론트엔드
if ps aux | grep -v grep | grep "vite" > /dev/null; then
    FRONTEND_PID=$(ps aux | grep -v grep | grep "vite" | awk '{print $2}')
    echo -e "${GREEN}✓ 프론트엔드 실행 중 (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}✗ 프론트엔드 중지됨${NC}"
fi
echo ""

# 4. 포트 상태
echo -e "${BLUE}[포트 상태]${NC}"
if netstat -tuln 2>/dev/null | grep ":8000 " > /dev/null; then
    echo -e "${GREEN}✓ 포트 8000 (백엔드) LISTENING${NC}"
else
    echo -e "${RED}✗ 포트 8000 사용 안 됨${NC}"
fi

if netstat -tuln 2>/dev/null | grep ":5173 " > /dev/null; then
    echo -e "${GREEN}✓ 포트 5173 (프론트엔드) LISTENING${NC}"
else
    echo -e "${RED}✗ 포트 5173 사용 안 됨${NC}"
fi
echo ""

# 5. 디스크 공간
echo -e "${BLUE}[디스크 공간]${NC}"
df -h /workspace | tail -1
echo ""

# 6. 생성된 비디오
echo -e "${BLUE}[생성된 비디오]${NC}"
if [ -d "$WORKSPACE/backend/generated_videos" ]; then
    VIDEO_COUNT=$(ls -1 $WORKSPACE/backend/generated_videos/*.mp4 2>/dev/null | wc -l)
    TOTAL_SIZE=$(du -sh $WORKSPACE/backend/generated_videos 2>/dev/null | cut -f1)
    echo "총 비디오 수: $VIDEO_COUNT"
    echo "총 용량: $TOTAL_SIZE"
else
    echo "비디오 디렉토리가 없습니다"
fi
echo ""

# 7. 최근 로그 (마지막 10줄)
echo -e "${BLUE}[최근 백엔드 로그]${NC}"
if [ -f "$WORKSPACE/backend/logs/backend.log" ]; then
    tail -5 $WORKSPACE/backend/logs/backend.log
else
    echo "로그 파일이 없습니다"
fi
echo ""

# 8. 접속 URL
echo -e "${BLUE}[접속 정보]${NC}"
echo "Runpod 대시보드에서 'Connect' 버튼을 클릭하고"
echo "HTTP Service 섹션에서 다음 포트를 확인하세요:"
echo "  - 포트 8000: 백엔드 API"
echo "  - 포트 5173: 프론트엔드 UI"
echo ""

echo "========================================"
