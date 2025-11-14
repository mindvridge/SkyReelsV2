/**
 * E2E tests for video generation workflow
 */

import { test, expect } from '@playwright/test';

test.describe('Video Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display video generation form', async ({ page }) => {
    // Check form elements exist
    await expect(page.getByPlaceholder(/프롬프트를 입력/)).toBeVisible();
    await expect(page.getByText(/모델 타입/)).toBeVisible();
    await expect(page.getByText(/생성하기/)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Click generate without prompt
    await page.getByRole('button', { name: /생성하기/ }).click();

    // Should show validation error
    await expect(page.getByText(/프롬프트를 입력해주세요/)).toBeVisible();
  });

  test('should create video generation job', async ({ page }) => {
    // Fill in prompt
    await page.getByPlaceholder(/프롬프트를 입력/).fill('A cat playing piano in a jazz club');

    // Select model settings (already has defaults)

    // Click generate
    await page.getByRole('button', { name: /생성하기/ }).click();

    // Should show success message and progress tracker
    await expect(page.getByText(/비디오 생성 시작/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/진행률/)).toBeVisible({ timeout: 5000 });
  });

  test('should display advanced options', async ({ page }) => {
    // Click advanced options toggle
    await page.getByText(/고급 설정/).click();

    // Should show advanced fields
    await expect(page.getByText(/프레임 수/)).toBeVisible();
    await expect(page.getByText(/Guidance Scale/)).toBeVisible();
    await expect(page.getByText(/Inference Steps/)).toBeVisible();
  });

  test('should show preset selector', async ({ page }) => {
    // Find preset selector
    const presetSelect = page.getByRole('combobox').first();
    await expect(presetSelect).toBeVisible();

    // Should have default presets
    await presetSelect.click();
    await expect(page.getByText(/빠른 생성/)).toBeVisible();
  });

  test('should save quick preset', async ({ page }) => {
    // Fill form
    await page.getByPlaceholder(/프롬프트를 입력/).fill('Test prompt');

    // Click quick preset save
    await page.getByRole('button', { name: /빠른 프리셋/ }).click();

    // Should save to localStorage
    const storage = await page.evaluate(() => localStorage.getItem('skyreels-quick-preset'));
    expect(storage).toBeTruthy();
  });
});

test.describe('Video Gallery', () => {
  test('should display video gallery', async ({ page }) => {
    await page.goto('/');

    // Gallery should be visible
    await expect(page.getByText(/비디오 갤러리/)).toBeVisible();
  });

  test('should filter videos by status', async ({ page }) => {
    await page.goto('/');

    // Click filter tabs
    await page.getByRole('tab', { name: /완료/ }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    await page.getByRole('tab', { name: /처리 중/ }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('should open video player modal', async ({ page }) => {
    await page.goto('/');

    // Find first video card (if exists)
    const videoCard = page.locator('[data-testid="video-card"]').first();
    const hasVideo = await videoCard.count() > 0;

    if (hasVideo) {
      // Click play button
      await videoCard.getByRole('button', { name: /재생/ }).click();

      // Modal should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('button', { name: /닫기/ })).toBeVisible();
    }
  });
});

test.describe('WebSocket Connection', () => {
  test('should show live indicator when connected', async ({ page }) => {
    await page.goto('/');

    // Create a video
    await page.getByPlaceholder(/프롬프트를 입력/).fill('Test video for WebSocket');
    await page.getByRole('button', { name: /생성하기/ }).click();

    // Should eventually show "Live" indicator
    await expect(page.getByText(/Live/)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Form should still be visible and functional
    await expect(page.getByPlaceholder(/프롬프트를 입력/)).toBeVisible();
    await expect(page.getByRole('button', { name: /생성하기/ })).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Gallery should adapt to tablet size
    await expect(page.getByText(/비디오 갤러리/)).toBeVisible();
  });
});
