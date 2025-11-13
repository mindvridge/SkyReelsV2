/**
 * Hook for polling video status
 */

import { useQuery } from '@tanstack/react-query';
import { getVideoStatus } from '@/services/api';
import type { Video } from '@/types/video';

interface UseVideoStatusOptions {
  jobId: string | null;
  enabled?: boolean;
  onComplete?: (video: Video) => void;
  onError?: (video: Video) => void;
}

export function useVideoStatus({ jobId, enabled = true, onComplete, onError }: UseVideoStatusOptions) {
  const query = useQuery({
    queryKey: ['video-status', jobId],
    queryFn: () => getVideoStatus(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (data) => {
      // Stop polling if completed or failed
      if (!data || data.status === 'completed' || data.status === 'failed') {
        // Call callbacks
        if (data) {
          if (data.status === 'completed' && onComplete) {
            onComplete(data);
          } else if (data.status === 'failed' && onError) {
            onError(data);
          }
        }
        return false;
      }
      // Poll every 2 seconds while processing
      return 2000;
    },
    refetchIntervalInBackground: false,
  });

  return {
    video: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
