/**
 * Hook for video generation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVideo } from '@/services/api';
import type { VideoCreateRequest, JobCreatedResponse } from '@/types/video';
import toast from 'react-hot-toast';

export function useVideoGeneration() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: VideoCreateRequest) => createVideo(data),
    onSuccess: (data: JobCreatedResponse) => {
      toast.success('Video generation started!');
      // Invalidate videos list to refetch
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to start generation: ${error.message}`);
    },
  });

  return {
    generateVideo: mutation.mutate,
    isGenerating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
