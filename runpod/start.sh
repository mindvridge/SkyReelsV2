#!/bin/bash

# SkyReels V2 Runpod 서비스 시작 스크립트
# 백엔드와 프론트엔드를 동시에 실행합니다.

set -e

echo "========================================"
echo "  SkyReels V2 서비스 시작"
echo "========================================"
echo ""

# 색상 코드
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 작업 디렉토리
WORKSPACE="/workspace/SkyReelsV2"
cd $WORKSPACE

# GPU 정보 표시
echo -e "${BLUE}GPU 정보:${NC}"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv
echo ""

# 로그 디렉토리 생성
mkdir -p backend/logs

# 백엔드 시작
echo -e "${YELLOW}[1/2] 백엔드 서버 시작 중...${NC}"
cd $WORKSPACE/backend
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ 백엔드 서버 시작됨 (PID: $BACKEND_PID)${NC}"
echo "  - 로그: $WORKSPACE/backend/logs/backend.log"
echo "  - API: http://0.0.0.0:8000"
echo ""

# 백엔드가 시작될 때까지 대기
echo "백엔드 서버 준비 대기 중..."
sleep 5

# 프론트엔드 시작 (이미 빌드된 경우 서빙만)
echo -e "${YELLOW}[2/2] 프론트엔드 서버 시작 중...${NC}"
cd $WORKSPACE/frontend

# 개발 모드로 실행
nohup npm run dev -- --host 0.0.0.0 --port 5173 > $WORKSPACE/backend/logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ 프론트엔드 서버 시작됨 (PID: $FRONTEND_PID)${NC}"
echo "  - 로그: $WORKSPACE/backend/logs/frontend.log"
echo "  - URL: http://0.0.0.0:5173"
echo ""

# 프로세스 정보 저장
echo $BACKEND_PID > $WORKSPACE/backend/.backend.pid
echo $FRONTEND_PID > $WORKSPACE/backend/.frontend.pid

echo "========================================"
echo -e "${GREEN}  모든 서비스가 시작되었습니다! ${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}접속 정보:${NC}"
echo "  - 백엔드 API: http://0.0.0.0:8000"
echo "  - API 문서: http://0.0.0.0:8000/docs"
echo "  - 프론트엔드: http://0.0.0.0:5173"
echo ""
echo -e "${BLUE}Runpod 포트 매핑:${NC}"
echo "  1. Runpod 대시보드에서 'Connect' 버튼 클릭"
echo "  2. 'HTTP Service' 탭에서 포트 확인:"
echo "     - 포트 8000: 백엔드 API"
echo "     - 포트 5173: 프론트엔드 UI"
echo ""
echo -e "${YELLOW}로그 확인:${NC}"
echo "  - 백엔드: tail -f $WORKSPACE/backend/logs/backend.log"
echo "  - 프론트엔드: tail -f $WORKSPACE/backend/logs/frontend.log"
echo ""
echo -e "${YELLOW}서비스 중지:${NC}"
echo "  - bash $WORKSPACE/runpod/stop.sh"
echo ""

# 메인 프로세스로 백엔드 로그 팔로우 (컨테이너가 종료되지 않도록)
echo "백엔드 로그를 표시합니다 (Ctrl+C로 종료하지 마세요)..."
echo "--------------------------------------"
tail -f $WORKSPACE/backend/logs/backend.log
