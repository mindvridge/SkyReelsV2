/**
 * Type definitions for video generation
 */

export type ModelType = 't2v' | 'i2v' | 'df';
export type Resolution = '540P' | '720P';
export type VideoStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VideoCreateRequest {
  prompt: string;
  model_type: ModelType;
  resolution: Resolution;
  num_frames: number;
  guidance_scale: number;
  num_inference_steps: number;
  image_url?: string;
}

export interface Video {
  id: string;
  prompt: string;
  model_type: ModelType;
  resolution: Resolution;
  num_frames: number;
  guidance_scale: number;
  status: VideoStatus;
  progress: number;
  video_url?: string;
  thumbnail_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface JobCreatedResponse {
  job_id: string;
  status: VideoStatus;
  created_at: string;
  message: string;
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface MessageResponse {
  message: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}
