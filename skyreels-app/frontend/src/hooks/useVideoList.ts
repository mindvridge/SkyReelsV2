/**
 * Hook for fetching video list
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listVideos, deleteVideo } from '@/services/api';
import type { VideoStatus } from '@/types/video';
import toast from 'react-hot-toast';

interface UseVideoListOptions {
  page?: number;
  limit?: number;
  status?: VideoStatus;
}

export function useVideoList({ page = 1, limit = 10, status }: UseVideoListOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['videos', page, limit, status],
    queryFn: () => listVideos(page, limit, status),
    refetchInterval: 5000, // Refetch every 5 seconds to update progress
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => deleteVideo(jobId),
    onSuccess: () => {
      toast.success('Video deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete video: ${error.message}`);
    },
  });

  return {
    videos: query.data?.videos || [],
    total: query.data?.total || 0,
    totalPages: query.data?.total_pages || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    deleteVideo: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
