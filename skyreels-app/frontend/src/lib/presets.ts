/**
 * Video generation presets
 */

import type { ModelType, ModelSize, Resolution } from '@/types/video';

export interface VideoPreset {
  id: string;
  name: string;
  description: string;
  modelType: ModelType;
  modelSize: ModelSize;
  resolution: Resolution;
  numFrames: number;
  guidanceScale: number;
  numInferenceSteps: number;
  isDefault?: boolean;
}

// Default presets
export const DEFAULT_PRESETS: VideoPreset[] = [
  {
    id: 'ultra-quality',
    name: 'Ultra Quality',
    description: '14B model, 720P, 50 steps - Highest quality, slowest',
    modelType: 't2v',
    modelSize: '14B',
    resolution: '720P',
    numFrames: 97,
    guidanceScale: 7.0,
    numInferenceSteps: 50,
    isDefault: true,
  },
  {
    id: 'high-quality',
    name: 'High Quality',
    description: '14B model, 540P, 30 steps - Great quality, balanced speed',
    modelType: 't2v',
    modelSize: '14B',
    resolution: '540P',
    numFrames: 97,
    guidanceScale: 6.0,
    numInferenceSteps: 30,
    isDefault: true,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: '1.3B model, 540P, 30 steps - Good quality, faster',
    modelType: 't2v',
    modelSize: '1.3B',
    resolution: '540P',
    numFrames: 97,
    guidanceScale: 6.0,
    numInferenceSteps: 30,
    isDefault: true,
  },
  {
    id: 'fast-draft',
    name: 'Fast Draft',
    description: '1.3B model, 540P, 20 steps - Quick previews',
    modelType: 't2v',
    modelSize: '1.3B',
    resolution: '540P',
    numFrames: 97,
    guidanceScale: 5.0,
    numInferenceSteps: 20,
    isDefault: true,
  },
  {
    id: 'long-video',
    name: 'Long Video',
    description: '14B model, 540P, 193 frames - Extended length',
    modelType: 'df',
    modelSize: '14B',
    resolution: '540P',
    numFrames: 193,
    guidanceScale: 6.0,
    numInferenceSteps: 30,
    isDefault: true,
  },
];

const STORAGE_KEY = 'skyreels-presets';

/**
 * Get all presets (default + custom)
 */
export function getAllPresets(): VideoPreset[] {
  const customPresets = getCustomPresets();
  return [...DEFAULT_PRESETS, ...customPresets];
}

/**
 * Get custom presets from localStorage
 */
export function getCustomPresets(): VideoPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading presets:', error);
    return [];
  }
}

/**
 * Save a new custom preset
 */
export function savePreset(preset: Omit<VideoPreset, 'id' | 'isDefault'>): VideoPreset {
  const newPreset: VideoPreset = {
    ...preset,
    id: `custom-${Date.now()}`,
    isDefault: false,
  };

  const customPresets = getCustomPresets();
  customPresets.push(newPreset);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
  } catch (error) {
    console.error('Error saving preset:', error);
    throw new Error('Failed to save preset');
  }

  return newPreset;
}

/**
 * Delete a custom preset
 */
export function deletePreset(id: string): void {
  // Cannot delete default presets
  if (DEFAULT_PRESETS.some(p => p.id === id)) {
    throw new Error('Cannot delete default presets');
  }

  const customPresets = getCustomPresets();
  const filtered = customPresets.filter(p => p.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting preset:', error);
    throw new Error('Failed to delete preset');
  }
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): VideoPreset | undefined {
  return getAllPresets().find(p => p.id === id);
}
