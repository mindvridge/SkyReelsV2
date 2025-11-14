# 📊 모니터링 가이드

SkyReels V2의 모니터링 및 에러 추적 시스템 가이드입니다.

## 📋 목차

1. [모니터링 개요](#모니터링-개요)
2. [백엔드 모니터링](#백엔드-모니터링)
3. [프론트엔드 에러 추적](#프론트엔드-에러-추적)
4. [메트릭 API](#메트릭-api)
5. [로그 확인](#로그-확인)
6. [알림 설정](#알림-설정)

---

## 모니터링 개요

### 수집되는 메트릭

#### 백엔드
- ✅ API 요청 수 및 응답 시간
- ✅ 에러 발생률
- ✅ 시스템 리소스 (CPU, 메모리, 디스크)
- ✅ 비디오 생성 성공률 및 소요 시간
- ✅ WebSocket 연결 수

#### 프론트엔드
- ✅ JavaScript 에러
- ✅ Unhandled Promise Rejection
- ✅ 컴포넌트 에러
- ✅ 네트워크 요청 실패

---

## 백엔드 모니터링

### 메트릭 엔드포인트

#### 1. 종합 메트릭

```bash
GET /api/v1/monitoring/metrics?minutes=60
```

**응답:**
```json
{
  "summary": {
    "uptime_hours": 24.5,
    "total_api_requests": 1234,
    "total_api_errors": 12,
    "total_videos_generated": 45,
    "total_videos_completed": 42,
    "total_videos_failed": 3,
    "overall_success_rate": 93.33
  },
  "system": {
    "cpu": {
      "percent": 45.2,
      "count": 8
    },
    "memory": {
      "total": 17179869184,
      "available": 8589934592,
      "percent": 50.0,
      "used": 8589934592
    },
    "disk": {
      "total": 500000000000,
      "used": 250000000000,
      "free": 250000000000,
      "percent": 50.0
    }
  },
  "api": {
    "total_requests": 1234,
    "total_errors": 12,
    "error_rate": 0.97,
    "endpoints": {
      "POST:/api/v1/videos/generate": {
        "count": 45,
        "avg_duration": 0.234
      }
    },
    "recent_errors": [...]
  },
  "videos": {
    "total_videos": 45,
    "completed": 42,
    "failed": 3,
    "success_rate": 93.33,
    "avg_generation_time": 125.5,
    "recent_failures": [...]
  }
}
```

#### 2. 시스템 메트릭만

```bash
GET /api/v1/monitoring/metrics/system
```

#### 3. API 메트릭만

```bash
GET /api/v1/monitoring/metrics/api?minutes=30
```

#### 4. 비디오 메트릭만

```bash
GET /api/v1/monitoring/metrics/videos?minutes=60
```

#### 5. 헬스 체크

```bash
GET /api/v1/monitoring/health
```

**응답:**
```json
{
  "status": "healthy",
  "uptime_hours": 24.5,
  "system": {
    "cpu": { "percent": 45.2 },
    "memory": { "percent": 50.0 }
  }
}
```

### 로깅

#### 로그 레벨

- **INFO**: 일반 작업 로그
- **WARNING**: 경고 (서비스는 정상)
- **ERROR**: 에러 발생
- **DEBUG**: 상세 디버그 정보

#### 로그 포맷

```
2024-11-14 12:34:56 - app.api.routes.videos - INFO - Created video job: abc-123
2024-11-14 12:34:56 - app.services.queue - INFO - [Progress] Job abc-123: 0%
```

#### Docker 로그 확인

```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스
docker-compose logs -f backend
docker-compose logs -f celery-worker

# 최근 100줄
docker-compose logs --tail=100 backend

# 특정 시간 이후
docker-compose logs --since=1h backend
```

#### 로그 필터링

```bash
# 에러만
docker-compose logs backend | grep ERROR

# 특정 Job ID
docker-compose logs backend | grep "abc-123"

# 진행률 업데이트
docker-compose logs celery-worker | grep "\[Progress\]"
```

### 시스템 모니터링

#### CPU/메모리 확인

```bash
# Docker 컨테이너 리소스
docker stats

# 실시간 모니터링
docker stats --no-stream

# 특정 컨테이너
docker stats skyreels-backend
```

#### 디스크 사용량

```bash
# 전체 볼륨
docker system df

# 상세 정보
docker system df -v

# 스토리지 정리
docker system prune -a
```

---

## 프론트엔드 에러 추적

### Error Tracker 사용

#### 초기화

```typescript
// src/App.tsx

import { errorTracker } from '@/lib/errorTracking';

function App() {
  useEffect(() => {
    // 에러 추적 자동 시작됨
    console.log('Error tracker initialized');
  }, []);

  return <div>...</div>;
}
```

#### 수동 에러 로깅

```typescript
import { logError } from '@/lib/errorTracking';

try {
  // 작업 수행
  performTask();
} catch (error) {
  logError('Task failed', error as Error, 'ComponentName');
}
```

#### 에러 확인

```typescript
import { errorTracker } from '@/lib/errorTracking';

// 모든 에러 가져오기
const errors = errorTracker.getErrors();

// 에러 개수
const count = errorTracker.getErrorCount();

// 에러 초기화
errorTracker.clearErrors();
```

### 브라우저 개발자 도구

#### Console 확인

```javascript
// 최근 에러 확인
JSON.parse(localStorage.getItem('error-logs'));

// 에러 추적 통계
console.table(errorTracker.getErrors());
```

#### Network 탭

- 실패한 API 요청 확인
- 응답 시간 모니터링
- WebSocket 연결 상태

---

## 메트릭 API

### Curl 예제

```bash
# 종합 메트릭 (최근 1시간)
curl http://localhost:8000/api/v1/monitoring/metrics?minutes=60

# 시스템 메트릭
curl http://localhost:8000/api/v1/monitoring/metrics/system

# WebSocket 통계
curl http://localhost:8000/ws/stats
```

### Python 예제

```python
import requests

# 메트릭 가져오기
response = requests.get('http://localhost:8000/api/v1/monitoring/metrics')
metrics = response.json()

# 에러율 확인
error_rate = metrics['api']['error_rate']
if error_rate > 5.0:
    print(f'Warning: High error rate {error_rate}%')

# 시스템 리소스 확인
cpu = metrics['system']['cpu']['percent']
memory = metrics['system']['memory']['percent']

print(f'CPU: {cpu}%, Memory: {memory}%')
```

### JavaScript 예제

```typescript
// 메트릭 API 호출
async function getMetrics(minutes: number = 60) {
  const response = await fetch(
    `http://localhost:8000/api/v1/monitoring/metrics?minutes=${minutes}`
  );
  const metrics = await response.json();

  console.log('System Health:', {
    uptime: metrics.summary.uptime_hours,
    cpu: metrics.system.cpu.percent,
    memory: metrics.system.memory.percent,
    errorRate: metrics.api.error_rate,
    videoSuccessRate: metrics.videos.success_rate,
  });

  return metrics;
}

// 사용
getMetrics(30);
```

---

## 로그 확인

### 실시간 로그 모니터링

```bash
# Tail 모드 (실시간)
docker-compose logs -f backend celery-worker

# 여러 터미널에서
# Terminal 1
docker-compose logs -f backend

# Terminal 2
docker-compose logs -f celery-worker

# Terminal 3
docker-compose logs -f frontend
```

### 로그 분석

#### 에러 빈도 확인

```bash
# 에러 개수
docker-compose logs backend | grep -c ERROR

# 에러 타입별 분류
docker-compose logs backend | grep ERROR | \
  awk '{print $NF}' | sort | uniq -c
```

#### 응답 시간 분석

```bash
# 평균 응답 시간
docker-compose logs backend | \
  grep "Time:" | \
  awk '{print $(NF-1)}' | \
  awk '{sum+=$1; count++} END {print sum/count "s"}'
```

#### 비디오 생성 통계

```bash
# 완료된 비디오
docker-compose logs celery-worker | grep -c "100% - Completed"

# 실패한 비디오
docker-compose logs celery-worker | grep -c "failed"
```

---

## 알림 설정

### 간단한 알림 스크립트

#### CPU/메모리 알림

```bash
#!/bin/bash
# monitor.sh

while true; do
  # CPU 확인
  CPU=$(docker stats --no-stream skyreels-backend | \
    tail -n 1 | awk '{print $3}' | sed 's/%//')

  if (( $(echo "$CPU > 80" | bc -l) )); then
    echo "[WARNING] High CPU: ${CPU}%"
    # 알림 보내기 (예: Slack, Discord 등)
  fi

  # 메모리 확인
  MEM=$(docker stats --no-stream skyreels-backend | \
    tail -n 1 | awk '{print $4}' | sed 's/%//')

  if (( $(echo "$MEM > 90" | bc -l) )); then
    echo "[WARNING] High Memory: ${MEM}%"
  fi

  sleep 60
done
```

#### 에러율 알림

```python
# monitor_errors.py

import requests
import time

API_URL = "http://localhost:8000/api/v1/monitoring/metrics"
ERROR_THRESHOLD = 5.0  # 5% 에러율

while True:
    try:
        response = requests.get(API_URL)
        metrics = response.json()

        error_rate = metrics['api']['error_rate']

        if error_rate > ERROR_THRESHOLD:
            print(f"⚠️ High error rate: {error_rate}%")
            # 알림 보내기

    except Exception as e:
        print(f"Monitoring failed: {e}")

    time.sleep(300)  # 5분마다 확인
```

### Slack/Discord 웹훅 통합

```python
import requests

def send_alert(message: str, webhook_url: str):
    """Slack/Discord로 알림 전송"""
    payload = {
        "text": message,
        "username": "SkyReels Monitor",
        "icon_emoji": ":warning:"
    }

    requests.post(webhook_url, json=payload)

# 사용
if error_rate > 5.0:
    send_alert(
        f"⚠️ High error rate: {error_rate}%",
        "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    )
```

---

## 대시보드 (선택사항)

### 간단한 HTML 대시보드

```html
<!DOCTYPE html>
<html>
<head>
    <title>SkyReels Monitor</title>
    <script>
        async function refreshMetrics() {
            const response = await fetch('http://localhost:8000/api/v1/monitoring/metrics');
            const data = await response.json();

            document.getElementById('uptime').textContent = data.summary.uptime_hours;
            document.getElementById('cpu').textContent = data.system.cpu.percent;
            document.getElementById('memory').textContent = data.system.memory.percent;
            document.getElementById('error_rate').textContent = data.api.error_rate;
        }

        // 10초마다 갱신
        setInterval(refreshMetrics, 10000);
        refreshMetrics();
    </script>
</head>
<body>
    <h1>SkyReels V2 Monitoring</h1>
    <p>Uptime: <span id="uptime"></span> hours</p>
    <p>CPU: <span id="cpu"></span>%</p>
    <p>Memory: <span id="memory"></span>%</p>
    <p>Error Rate: <span id="error_rate"></span>%</p>
</body>
</html>
```

---

## 베스트 프랙티스

1. **정기적인 로그 확인**
   - 하루 1-2회 에러 로그 검토
   - 주요 메트릭 트렌드 모니터링

2. **알림 임계값 설정**
   - CPU > 80%
   - 메모리 > 90%
   - 에러율 > 5%
   - 비디오 실패율 > 10%

3. **로그 보관**
   - 최소 30일간 로그 보관
   - 중요 에러는 별도 저장

4. **성능 최적화**
   - 느린 API 엔드포인트 식별
   - 비디오 생성 시간 추적
   - 리소스 병목 지점 파악

---

## 문제 해결

### 높은 에러율

```bash
# 최근 에러 확인
curl http://localhost:8000/api/v1/monitoring/metrics/api | jq '.recent_errors'

# 에러 패턴 분석
docker-compose logs backend | grep ERROR | tail -20
```

### 높은 CPU/메모리

```bash
# 리소스 사용 확인
docker stats

# 프로세스 확인
docker-compose exec backend top
```

### WebSocket 연결 문제

```bash
# WebSocket 통계
curl http://localhost:8000/ws/stats

# WebSocket 로그
docker-compose logs backend | grep WebSocket
```

---

**마지막 업데이트**: 2024-11-14
**버전**: 1.0.0
