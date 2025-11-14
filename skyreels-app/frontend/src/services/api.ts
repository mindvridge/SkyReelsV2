/**
 * API client for SkyReels V2 backend
 */

import api, { handleApiError } from '@/lib/axios';
import { AxiosError } from 'axios';
import type {
  VideoCreateRequest,
  Video,
  JobCreatedResponse,
  VideoListResponse,
  MessageResponse,
  HealthResponse,
  VideoStatus,
} from '@/types/video';

class ApiClient {
  /**
   * Wrapper to handle API errors consistently
   */
  private async handleRequest<T>(request: Promise<any>, context?: string): Promise<T> {
    try {
      const response = await request;
      return response.data;
    } catch (error) {
      const errorMessage = handleApiError(error as AxiosError, context);
      console.error(context || 'API Error:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Health check
   */
  async health(): Promise<HealthResponse> {
    return this.handleRequest<HealthResponse>(
      api.get('/api/v1/health'),
      'Health check failed'
    );
  }

  /**
   * Create a new video generation job
   */
  async createVideo(data: VideoCreateRequest): Promise<JobCreatedResponse> {
    return this.handleRequest<JobCreatedResponse>(
      api.post('/api/v1/videos/generate', data),
      'Failed to create video'
    );
  }

  /**
   * Get video status by job ID
   */
  async getVideoStatus(jobId: string): Promise<Video> {
    return this.handleRequest<Video>(
      api.get(`/api/v1/videos/status/${jobId}`),
      'Failed to get video status'
    );
  }

  /**
   * Get video details by job ID
   */
  async getVideo(jobId: string): Promise<Video> {
    return this.handleRequest<Video>(
      api.get(`/api/v1/videos/${jobId}`),
      'Failed to get video'
    );
  }

  /**
   * List all videos with pagination
   */
  async listVideos(page: number = 1, limit: number = 10, status?: VideoStatus): Promise<VideoListResponse> {
    const params: Record<string, string | number> = { page, limit };
    if (status) {
      params.status = status;
    }

    return this.handleRequest<VideoListResponse>(
      api.get('/api/v1/videos/list', { params }),
      'Failed to list videos'
    );
  }

  /**
   * Cancel a video generation job
   */
  async cancelVideo(jobId: string): Promise<MessageResponse> {
    return this.handleRequest<MessageResponse>(
      api.post(`/api/v1/videos/${jobId}/cancel`),
      'Failed to cancel video'
    );
  }

  /**
   * Cancel all active video generation jobs
   */
  async cancelAllVideos(): Promise<MessageResponse> {
    return this.handleRequest<MessageResponse>(
      api.post('/api/v1/videos/cancel-all'),
      'Failed to cancel all videos'
    );
  }

  /**
   * Delete a video by job ID
   */
  async deleteVideo(jobId: string): Promise<MessageResponse> {
    return this.handleRequest<MessageResponse>(
      api.delete(`/api/v1/videos/${jobId}`),
      'Failed to delete video'
    );
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export individual functions for convenience (bind to preserve 'this' context)
export const health = apiClient.health.bind(apiClient);
export const createVideo = apiClient.createVideo.bind(apiClient);
export const getVideoStatus = apiClient.getVideoStatus.bind(apiClient);
export const getVideo = apiClient.getVideo.bind(apiClient);
export const listVideos = apiClient.listVideos.bind(apiClient);
export const cancelVideo = apiClient.cancelVideo.bind(apiClient);
export const cancelAllVideos = apiClient.cancelAllVideos.bind(apiClient);
export const deleteVideo = apiClient.deleteVideo.bind(apiClient);
