#!/bin/bash

# SkyReels V2 Runpod 빠른 시작 스크립트
# 설정 + 시작을 한 번에 실행합니다.

set -e

echo "========================================"
echo "  SkyReels V2 빠른 시작"
echo "========================================"
echo ""

WORKSPACE="/workspace/SkyReelsV2"
cd $WORKSPACE

# 1. 초기 설정 실행
echo "초기 설정을 시작합니다..."
bash runpod/setup.sh

echo ""
echo "설정이 완료되었습니다!"
echo "5초 후 서비스를 시작합니다..."
sleep 5

# 2. 서비스 시작
echo ""
bash runpod/start.sh
