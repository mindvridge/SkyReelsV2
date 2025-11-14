/**
 * Hook for monitoring video status with WebSocket (preferred) and polling (fallback)
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getVideoStatus } from '@/services/api';
import { useVideoProgressWebSocket } from '@/hooks/useWebSocket';
import type { Video } from '@/types/video';

interface UseVideoStatusOptions {
  jobId: string | null;
  enabled?: boolean;
  onComplete?: (video: Video) => void;
  onError?: (video: Video) => void;
  useWebSocket?: boolean; // Enable/disable WebSocket (default: true)
}

export function useVideoStatus({
  jobId,
  enabled = true,
  onComplete,
  onError,
  useWebSocket = true
}: UseVideoStatusOptions) {
  const [currentVideo, setCurrentVideo] = useState<Video | undefined>();
  const callbacksCalledRef = useRef({ complete: false, error: false });

  // WebSocket connection for real-time updates
  const { isConnected: wsConnected } = useVideoProgressWebSocket(
    useWebSocket && enabled && jobId ? jobId : null,
    (data) => {
      // Handle WebSocket progress updates
      if (data.video) {
        setCurrentVideo(data.video);

        // Call callbacks once when status changes to completed/failed
        if (data.video.status === 'completed' && !callbacksCalledRef.current.complete) {
          callbacksCalledRef.current.complete = true;
          onComplete?.(data.video);
        } else if (data.video.status === 'failed' && !callbacksCalledRef.current.error) {
          callbacksCalledRef.current.error = true;
          onError?.(data.video);
        }
      }
    }
  );

  // Fallback to polling if WebSocket is disabled or not connected
  const shouldPoll = enabled && !!jobId && (!useWebSocket || !wsConnected);

  const query = useQuery<Video>({
    queryKey: ['video-status', jobId],
    queryFn: () => getVideoStatus(jobId!),
    enabled: shouldPoll as boolean,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling if completed or failed
      if (!data || data.status === 'completed' || data.status === 'failed') {
        // Update current video from polling
        if (data) {
          setCurrentVideo(data);

          // Call callbacks once
          if (data.status === 'completed' && !callbacksCalledRef.current.complete) {
            callbacksCalledRef.current.complete = true;
            onComplete?.(data);
          } else if (data.status === 'failed' && !callbacksCalledRef.current.error) {
            callbacksCalledRef.current.error = true;
            onError?.(data);
          }
        }
        return false;
      }
      // Poll every 2 seconds while processing
      return 2000;
    },
    refetchIntervalInBackground: false,
  });

  // Update current video from query data if not using WebSocket
  useEffect(() => {
    if (query.data && !wsConnected && query.data.id) {
      setCurrentVideo(query.data);
    }
  }, [query.data, wsConnected]);

  // Reset callbacks when jobId changes
  useEffect(() => {
    callbacksCalledRef.current = { complete: false, error: false };
  }, [jobId]);

  return {
    video: currentVideo,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isUsingWebSocket: wsConnected,
  };
}
