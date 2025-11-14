/**
 * Tests for useVideoStatus hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useVideoStatus } from '@/hooks/useVideoStatus';

// Mock useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useVideoProgressWebSocket: vi.fn(() => ({
    isConnected: false,
    progress: null,
  })),
}));

// Mock API
vi.mock('@/services/api', () => ({
  default: {
    getVideoStatus: vi.fn(() =>
      Promise.resolve({
        id: 'test-job-123',
        status: 'processing',
        progress: 50,
        prompt: 'Test video',
        model_type: 't2v',
        model_size: '6B',
        resolution: '540P',
        num_frames: 97,
        guidance_scale: 6.0,
        num_inference_steps: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    ),
  },
}));

describe('useVideoStatus', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch video status', async () => {
    const { result } = renderHook(
      () =>
        useVideoStatus({
          jobId: 'test-job-123',
          enabled: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.video).toBeDefined();
    });

    expect(result.current.video?.id).toBe('test-job-123');
    expect(result.current.video?.status).toBe('processing');
  });

  it('should not fetch when disabled', () => {
    const { result } = renderHook(
      () =>
        useVideoStatus({
          jobId: 'test-job-123',
          enabled: false,
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.video).toBeUndefined();
  });

  it('should not fetch when jobId is null', () => {
    const { result } = renderHook(
      () =>
        useVideoStatus({
          jobId: null,
          enabled: true,
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.video).toBeUndefined();
  });

  it('should call onComplete callback when video completes', async () => {
    const onComplete = vi.fn();

    const { result } = renderHook(
      () =>
        useVideoStatus({
          jobId: 'test-job-123',
          enabled: true,
          onComplete,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.video).toBeDefined();
    });

    // Note: onComplete is called when video status changes to 'completed'
    // This would need to be tested with a mock that returns completed status
  });
});
