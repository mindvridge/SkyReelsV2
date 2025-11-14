# 🧪 테스팅 가이드

SkyReels V2의 완전한 테스트 시스템 가이드입니다.

## 📋 목차

1. [테스트 개요](#테스트-개요)
2. [백엔드 테스트](#백엔드-테스트-pytest)
3. [프론트엔드 테스트](#프론트엔드-테스트-vitest)
4. [E2E 테스트](#e2e-테스트-playwright)
5. [테스트 실행 방법](#테스트-실행-방법)
6. [테스트 작성 가이드](#테스트-작성-가이드)
7. [CI/CD 통합](#cicd-통합)

---

## 테스트 개요

### 테스트 구조

```
SkyReelsV2/
├── backend/
│   ├── tests/
│   │   ├── unit/              # 단위 테스트
│   │   │   ├── test_api_health.py
│   │   │   ├── test_api_videos.py
│   │   │   ├── test_websocket_security.py
│   │   │   └── test_models.py
│   │   ├── integration/       # 통합 테스트
│   │   │   ├── test_websocket.py
│   │   │   └── test_video_workflow.py
│   │   └── conftest.py        # Pytest 설정
│   ├── pytest.ini             # Pytest 설정
│   └── requirements-test.txt  # 테스트 의존성
│
└── frontend/
    ├── e2e/                   # E2E 테스트
    │   └── video-generation.spec.ts
    ├── src/__tests__/         # 단위/통합 테스트
    │   ├── setup.ts           # Vitest 설정
    │   ├── lib/
    │   │   ├── settingsStorage.test.ts
    │   │   └── utils.test.ts
    │   └── hooks/
    │       └── useVideoStatus.test.ts
    ├── vitest.config.ts       # Vitest 설정
    └── playwright.config.ts   # Playwright 설정
```

### 테스트 커버리지 목표

| 항목 | 목표 | 현재 상태 |
|------|------|-----------|
| 백엔드 전체 | 70%+ | ✅ 구현됨 |
| 프론트엔드 전체 | 60%+ | ✅ 구현됨 |
| 핵심 API 엔드포인트 | 90%+ | ✅ 구현됨 |
| 핵심 컴포넌트 | 80%+ | ✅ 구현됨 |

---

## 백엔드 테스트 (Pytest)

### 설치

```bash
cd skyreels-app/backend

# 테스트 의존성 설치
pip install -r requirements-test.txt
```

### 테스트 실행

```bash
# 모든 테스트 실행
pytest

# 커버리지와 함께 실행
pytest --cov=app

# 특정 테스트 파일만 실행
pytest tests/unit/test_api_videos.py

# 특정 테스트 함수만 실행
pytest tests/unit/test_api_videos.py::test_generate_video_t2v

# 마커로 필터링
pytest -m unit          # 단위 테스트만
pytest -m integration   # 통합 테스트만
pytest -m "not slow"    # 느린 테스트 제외

# Verbose 모드
pytest -v

# 실패한 테스트만 재실행
pytest --lf

# 병렬 실행 (pytest-xdist 필요)
pytest -n auto
```

### 테스트 구조

#### 1. 단위 테스트 (Unit Tests)

**API 엔드포인트 테스트**

```python
# tests/unit/test_api_videos.py

def test_generate_video_t2v(client: TestClient, sample_video_data):
    """T2V 비디오 생성 엔드포인트 테스트"""
    response = client.post("/api/v1/videos/generate", json=sample_video_data)

    assert response.status_code == 202  # Accepted
    data = response.json()

    assert "job_id" in data
    assert data["status"] == "queued"
```

**WebSocket 보안 테스트**

```python
# tests/unit/test_websocket_security.py

@pytest.mark.asyncio
async def test_validate_connection_origin_blocked(security_manager, mock_websocket):
    """Origin 차단 테스트"""
    mock_websocket.headers = {"origin": "http://malicious-site.com"}

    is_valid, error, ip = await security_manager.validate_connection(
        mock_websocket, "job-123", check_origin=True
    )

    assert is_valid is False
    assert "Origin not allowed" in error
```

**모델 및 스키마 테스트**

```python
# tests/unit/test_models.py

def test_video_create_schema_valid():
    """VideoCreate 스키마 유효성 테스트"""
    data = {
        "prompt": "A cat playing piano",
        "model_type": "t2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
    }

    video = VideoCreate(**data)
    assert video.prompt == "A cat playing piano"
```

#### 2. 통합 테스트 (Integration Tests)

**WebSocket 통합 테스트**

```python
# tests/integration/test_websocket.py

@pytest.mark.integration
def test_websocket_connection(client: TestClient, test_db: Session):
    """WebSocket 연결 및 초기 메시지 테스트"""
    # 비디오 생성
    video = Video(...)
    test_db.add(video)
    test_db.commit()

    # WebSocket 연결
    with client.websocket_connect(f"/ws/progress/{video.id}") as websocket:
        # 초기 상태 수신
        data = websocket.receive_json()

        assert data["type"] == "progress"
        assert data["video"]["id"] == str(video.id)
```

**전체 워크플로우 테스트**

```python
# tests/integration/test_video_workflow.py

@pytest.mark.integration
@pytest.mark.slow
def test_complete_video_generation_workflow(client, sample_video_data):
    """완전한 비디오 생성 워크플로우 테스트"""
    # 1. 작업 생성
    response = client.post("/api/v1/videos/generate", json=sample_video_data)
    job_id = response.json()["job_id"]

    # 2. 상태 확인
    response = client.get(f"/api/v1/videos/status/{job_id}")
    assert response.status_code == 200

    # 3. 목록에 표시
    response = client.get("/api/v1/videos/list")
    assert job_id in [v["id"] for v in response.json()["items"]]

    # 4. 취소
    response = client.post(f"/api/v1/videos/{job_id}/cancel")
    assert response.status_code == 200

    # 5. 삭제
    response = client.delete(f"/api/v1/videos/{job_id}")
    assert response.status_code == 200
```

### Fixtures

```python
# tests/conftest.py

@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    """각 테스트마다 새로운 in-memory DB"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(bind=engine)
    session = TestingSessionLocal()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_video_data():
    """샘플 비디오 생성 데이터"""
    return {
        "prompt": "A cat playing piano in a jazz club",
        "model_type": "t2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
    }
```

### 커버리지 리포트

```bash
# HTML 리포트 생성
pytest --cov=app --cov-report=html

# 리포트 확인
open htmlcov/index.html

# Terminal에서 보기
pytest --cov=app --cov-report=term-missing

# 최소 커버리지 설정 (pytest.ini)
# cov-fail-under=70
```

---

## 프론트엔드 테스트 (Vitest)

### 설치

```bash
cd skyreels-app/frontend

# 테스트 의존성 설치
npm install --save-dev vitest @vitest/ui jsdom \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event
```

### 테스트 실행

```bash
# 모든 테스트 실행
npm test

# Watch 모드 (개발 중)
npm test -- --watch

# UI 모드 (브라우저에서 실행)
npm run test:ui

# 커버리지
npm run test:coverage

# 특정 파일만
npm test -- settingsStorage.test.ts

# 업데이트 모드
npm test -- --update
```

### 테스트 구조

#### 유틸리티 함수 테스트

```typescript
// src/__tests__/lib/utils.test.ts

import { describe, it, expect } from 'vitest';
import { getStatusColor, formatDate } from '@/lib/utils';

describe('utils', () => {
  describe('getStatusColor', () => {
    it('should return correct color for queued', () => {
      expect(getStatusColor('queued')).toContain('yellow');
    });

    it('should return correct color for completed', () => {
      expect(getStatusColor('completed')).toContain('green');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toMatch(/2024/);
    });
  });
});
```

#### 스토리지 테스트

```typescript
// src/__tests__/lib/settingsStorage.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { saveSettings, loadSettings, clearSettings } from '@/lib/settingsStorage';

describe('settingsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save and load settings', () => {
    const settings = {
      modelType: 't2v',
      modelSize: '6B',
      resolution: '540P',
      numFrames: 97,
    };

    saveSettings(settings);
    const loaded = loadSettings();

    expect(loaded).not.toBeNull();
    expect(loaded?.modelType).toBe('t2v');
  });
});
```

#### 커스텀 훅 테스트

```typescript
// src/__tests__/hooks/useVideoStatus.test.ts

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useVideoStatus } from '@/hooks/useVideoStatus';

describe('useVideoStatus', () => {
  it('should fetch video status', async () => {
    const { result } = renderHook(
      () => useVideoStatus({ jobId: 'test-123', enabled: true }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.video).toBeDefined();
    });

    expect(result.current.video?.id).toBe('test-123');
  });
});
```

### Mock 설정

```typescript
// src/__tests__/setup.ts

import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// 테스트 후 cleanup
afterEach(() => {
  cleanup();
});

// window.matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

// localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
```

---

## E2E 테스트 (Playwright)

### 설치

```bash
cd skyreels-app/frontend

# Playwright 설치
npm install --save-dev @playwright/test

# 브라우저 설치
npx playwright install
```

### 테스트 실행

```bash
# 모든 E2E 테스트 실행
npm run test:e2e

# UI 모드 (대화형)
npm run test:e2e:ui

# Headed 모드 (브라우저 표시)
npx playwright test --headed

# 특정 브라우저만
npx playwright test --project=chromium

# 디버그 모드
npx playwright test --debug

# 리포트 보기
npx playwright show-report
```

### E2E 테스트 예제

```typescript
// e2e/video-generation.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Video Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should create video generation job', async ({ page }) => {
    // 프롬프트 입력
    await page.getByPlaceholder(/프롬프트를 입력/).fill('Test video');

    // 생성 버튼 클릭
    await page.getByRole('button', { name: /생성하기/ }).click();

    // 성공 메시지 확인
    await expect(page.getByText(/비디오 생성 시작/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should validate required fields', async ({ page }) => {
    // 빈 폼으로 제출
    await page.getByRole('button', { name: /생성하기/ }).click();

    // 에러 메시지 확인
    await expect(page.getByText(/프롬프트를 입력해주세요/)).toBeVisible();
  });
});
```

### 반응형 테스트

```typescript
test('should work on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  // 모바일에서도 정상 작동 확인
  await expect(page.getByPlaceholder(/프롬프트를 입력/)).toBeVisible();
});
```

---

## 테스트 실행 방법

### 개발 중 (Watch 모드)

```bash
# 백엔드 - 변경 시 자동 재실행
cd skyreels-app/backend
pytest --watch

# 프론트엔드 - 변경 시 자동 재실행
cd skyreels-app/frontend
npm test -- --watch
```

### CI/CD용 (전체 실행)

```bash
# 백엔드
cd skyreels-app/backend
pip install -r requirements-test.txt
pytest --cov=app --cov-report=xml

# 프론트엔드
cd skyreels-app/frontend
npm install
npm run test:coverage
npm run test:e2e
```

### Docker에서 실행

```bash
# 백엔드 테스트
docker-compose run --rm backend pytest

# 프론트엔드 테스트
docker-compose run --rm frontend npm test
```

---

## 테스트 작성 가이드

### 좋은 테스트의 원칙

1. **FIRST 원칙**
   - **F**ast: 빠르게 실행
   - **I**ndependent: 독립적으로 실행 가능
   - **R**epeatable: 반복 가능
   - **S**elf-validating: 자동으로 성공/실패 판단
   - **T**imely: 적시에 작성

2. **AAA 패턴**
   ```python
   def test_example():
       # Arrange (준비)
       data = {"test": "data"}

       # Act (실행)
       result = function_to_test(data)

       # Assert (검증)
       assert result == expected_value
   ```

3. **테스트 이름 작성법**
   - 명확하고 설명적으로
   - 무엇을 테스트하는지 명시
   - 예상 결과 포함

   ```python
   # Good ✅
   def test_generate_video_returns_job_id_when_valid_data():
       pass

   # Bad ❌
   def test_video():
       pass
   ```

### 백엔드 테스트 작성

```python
# 1. 필요한 import
import pytest
from fastapi.testclient import TestClient

# 2. 테스트 함수 작성
def test_endpoint_name(client: TestClient):
    """테스트 설명"""
    # Arrange
    request_data = {...}

    # Act
    response = client.post("/endpoint", json=request_data)

    # Assert
    assert response.status_code == 200
    assert "expected_key" in response.json()
```

### 프론트엔드 테스트 작성

```typescript
// 1. Import
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// 2. 테스트 작성
describe('ComponentName', () => {
  it('should render correctly', () => {
    // Arrange
    render(<ComponentName />);

    // Act & Assert
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ComponentName />);

    // Act
    await user.click(screen.getByRole('button'));

    // Assert
    expect(screen.getByText('Updated Text')).toBeInTheDocument();
  });
});
```

---

## CI/CD 통합

### GitHub Actions 예제

```yaml
# .github/workflows/test.yml

name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd skyreels-app/backend
          pip install -r requirements-test.txt

      - name: Run tests
        run: |
          cd skyreels-app/backend
          pytest --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd skyreels-app/frontend
          npm ci

      - name: Run unit tests
        run: |
          cd skyreels-app/frontend
          npm run test:coverage

      - name: Run E2E tests
        run: |
          cd skyreels-app/frontend
          npx playwright install --with-deps
          npm run test:e2e
```

---

## 문제 해결

### 일반적인 문제

**1. 테스트가 느림**
```bash
# 병렬 실행
pytest -n auto
npm test -- --no-coverage  # 커버리지 비활성화
```

**2. 테스트가 간헐적으로 실패**
- 비동기 타이밍 문제 확인
- `waitFor` 또는 `await` 사용
- 테스트 간 상태 격리 확인

**3. Mock이 작동하지 않음**
- Mock 경로 확인
- Import 순서 확인
- Mock 리셋 확인 (`beforeEach`)

**4. 커버리지가 낮음**
```bash
# 커버리지 리포트로 누락 부분 확인
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

---

## 추가 리소스

- [Pytest 문서](https://docs.pytest.org/)
- [Vitest 문서](https://vitest.dev/)
- [Playwright 문서](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)

---

**마지막 업데이트**: 2024-11-14
**버전**: 1.0.0
