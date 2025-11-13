/**
 * API client for SkyReels V2 backend
 */

import axios, { AxiosInstance } from 'axios';
import type {
  VideoCreateRequest,
  Video,
  JobCreatedResponse,
  VideoListResponse,
  MessageResponse,
  HealthResponse,
  VideoStatus,
} from '@/types/video';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL: `${baseURL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error status
          const message = error.response.data?.detail || error.message;
          console.error('API Error:', message);
          throw new Error(message);
        } else if (error.request) {
          // Request made but no response
          console.error('Network Error:', error.message);
          throw new Error('Network error. Please check your connection.');
        } else {
          // Something else happened
          console.error('Error:', error.message);
          throw error;
        }
      }
    );
  }

  /**
   * Health check
   */
  async health(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health');
    return response.data;
  }

  /**
   * Create a new video generation job
   */
  async createVideo(data: VideoCreateRequest): Promise<JobCreatedResponse> {
    const response = await this.client.post<JobCreatedResponse>('/videos/generate', data);
    return response.data;
  }

  /**
   * Get video status by job ID
   */
  async getVideoStatus(jobId: string): Promise<Video> {
    const response = await this.client.get<Video>(`/videos/status/${jobId}`);
    return response.data;
  }

  /**
   * Get video details by job ID
   */
  async getVideo(jobId: string): Promise<Video> {
    const response = await this.client.get<Video>(`/videos/${jobId}`);
    return response.data;
  }

  /**
   * List all videos with pagination
   */
  async listVideos(page: number = 1, limit: number = 10, status?: VideoStatus): Promise<VideoListResponse> {
    const params: Record<string, string | number> = { page, limit };
    if (status) {
      params.status = status;
    }

    const response = await this.client.get<VideoListResponse>('/videos/list', { params });
    return response.data;
  }

  /**
   * Delete a video by job ID
   */
  async deleteVideo(jobId: string): Promise<MessageResponse> {
    const response = await this.client.delete<MessageResponse>(`/videos/${jobId}`);
    return response.data;
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export individual functions for convenience
export const {
  health,
  createVideo,
  getVideoStatus,
  getVideo,
  listVideos,
  deleteVideo,
} = apiClient;
