/**
 * Zustand store for video state management
 */

import { create } from 'zustand';
import type { Video, ModelType, Resolution } from '@/types/video';

interface VideoFormState {
  prompt: string;
  modelType: ModelType;
  resolution: Resolution;
  numFrames: number;
  guidanceScale: number;
  numInferenceSteps: number;
  imageUrl: string;
  showAdvanced: boolean;
}

interface VideoStore {
  // Form state
  form: VideoFormState;
  setForm: (updates: Partial<VideoFormState>) => void;
  resetForm: () => void;

  // Current job tracking
  currentJobId: string | null;
  setCurrentJobId: (jobId: string | null) => void;

  // Selected video for viewing
  selectedVideo: Video | null;
  setSelectedVideo: (video: Video | null) => void;
}

const defaultFormState: VideoFormState = {
  prompt: '',
  modelType: 't2v',
  resolution: '540P',
  numFrames: 97,
  guidanceScale: 6.0,
  numInferenceSteps: 30,
  imageUrl: '',
  showAdvanced: false,
};

export const useVideoStore = create<VideoStore>((set) => ({
  form: defaultFormState,
  setForm: (updates) =>
    set((state) => ({
      form: { ...state.form, ...updates },
    })),
  resetForm: () =>
    set({
      form: defaultFormState,
    }),

  currentJobId: null,
  setCurrentJobId: (jobId) =>
    set({
      currentJobId: jobId,
    }),

  selectedVideo: null,
  setSelectedVideo: (video) =>
    set({
      selectedVideo: video,
    }),
}));
