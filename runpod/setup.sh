#!/bin/bash

# SkyReels V2 Runpod 초기 설정 스크립트
# Runpod에서 처음 실행할 때 한 번만 실행하면 됩니다.

set -e

echo "========================================"
echo "  SkyReels V2 Runpod 초기 설정"
echo "========================================"
echo ""

# 색상 코드
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 작업 디렉토리로 이동
cd /workspace/SkyReelsV2

# 1. GPU 확인
echo -e "${YELLOW}[1/6] GPU 확인 중...${NC}"
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total --format=csv
    echo -e "${GREEN}✓ GPU 감지 완료${NC}"
else
    echo -e "${RED}✗ GPU를 찾을 수 없습니다!${NC}"
    echo "Runpod에서 GPU 인스턴스를 선택했는지 확인하세요."
    exit 1
fi

# 2. CUDA 확인
echo -e "\n${YELLOW}[2/6] CUDA 확인 중...${NC}"
if command -v nvcc &> /dev/null; then
    nvcc --version | grep "release"
    echo -e "${GREEN}✓ CUDA 설치 확인${NC}"
else
    echo -e "${RED}✗ CUDA를 찾을 수 없습니다!${NC}"
    exit 1
fi

# 3. Python 및 PyTorch 확인
echo -e "\n${YELLOW}[3/6] Python 및 PyTorch 확인 중...${NC}"
python --version
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'CUDA Version: {torch.version.cuda}'); print(f'GPU Count: {torch.cuda.device_count()}')"

if python -c "import torch; exit(0 if torch.cuda.is_available() else 1)"; then
    echo -e "${GREEN}✓ PyTorch CUDA 사용 가능${NC}"
else
    echo -e "${RED}✗ PyTorch에서 CUDA를 사용할 수 없습니다!${NC}"
    echo "PyTorch를 재설치하세요: pip install torch --index-url https://download.pytorch.org/whl/cu118"
    exit 1
fi

# 4. 데이터베이스 초기화
echo -e "\n${YELLOW}[4/6] 데이터베이스 초기화 중...${NC}"
cd backend
if [ ! -f "app.db" ]; then
    python -c "from app.database import init_db; init_db()"
    echo -e "${GREEN}✓ 데이터베이스 생성 완료${NC}"
else
    echo -e "${GREEN}✓ 데이터베이스가 이미 존재합니다${NC}"
fi

# 5. 환경 변수 설정
echo -e "\n${YELLOW}[5/6] 환경 변수 설정 중...${NC}"
cd /workspace/SkyReelsV2
if [ ! -f ".env" ]; then
    cp runpod/.env.runpod .env
    echo -e "${GREEN}✓ .env 파일 생성 완료${NC}"
else
    echo -e "${GREEN}✓ .env 파일이 이미 존재합니다${NC}"
fi

# 6. 디렉토리 권한 설정
echo -e "\n${YELLOW}[6/6] 디렉토리 권한 설정 중...${NC}"
mkdir -p backend/generated_videos backend/models backend/logs
chmod -R 755 backend/generated_videos backend/models backend/logs
echo -e "${GREEN}✓ 디렉토리 권한 설정 완료${NC}"

# 완료 메시지
echo ""
echo "========================================"
echo -e "${GREEN}  초기 설정이 완료되었습니다! ${NC}"
echo "========================================"
echo ""
echo "다음 명령으로 서비스를 시작하세요:"
echo -e "${YELLOW}  bash /workspace/SkyReelsV2/runpod/start.sh${NC}"
echo ""
echo "또는 개별적으로 실행:"
echo "  - 백엔드: cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "  - 프론트엔드: cd frontend && npm run dev -- --host 0.0.0.0 --port 5173"
echo ""
