#!/bin/bash

# SkyReels V2 Runpod 서비스 중지 스크립트

set -e

echo "========================================"
echo "  SkyReels V2 서비스 중지"
echo "========================================"
echo ""

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

WORKSPACE="/workspace/SkyReelsV2"

# 백엔드 중지
if [ -f "$WORKSPACE/backend/.backend.pid" ]; then
    BACKEND_PID=$(cat $WORKSPACE/backend/.backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID
        echo -e "${GREEN}✓ 백엔드 서버 중지됨 (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}✗ 백엔드 프로세스를 찾을 수 없습니다${NC}"
    fi
    rm -f $WORKSPACE/backend/.backend.pid
else
    echo "백엔드 PID 파일을 찾을 수 없습니다"
fi

# 프론트엔드 중지
if [ -f "$WORKSPACE/backend/.frontend.pid" ]; then
    FRONTEND_PID=$(cat $WORKSPACE/backend/.frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID
        echo -e "${GREEN}✓ 프론트엔드 서버 중지됨 (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}✗ 프론트엔드 프로세스를 찾을 수 없습니다${NC}"
    fi
    rm -f $WORKSPACE/backend/.frontend.pid
else
    echo "프론트엔드 PID 파일을 찾을 수 없습니다"
fi

# 추가로 남아있는 프로세스 정리
echo ""
echo "남은 프로세스 확인 중..."
pkill -f "uvicorn app.main:app" || true
pkill -f "vite" || true

echo ""
echo -e "${GREEN}모든 서비스가 중지되었습니다.${NC}"
