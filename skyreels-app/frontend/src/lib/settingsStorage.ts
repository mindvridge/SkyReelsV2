/**
 * Settings storage management
 */

const STORAGE_KEY = 'skyreels-settings';
const QUICK_PRESET_KEY = 'skyreels-quick-preset';
const SELECTED_PRESET_KEY = 'skyreels-selected-preset';

export interface SavedSettings {
  modelType: string;
  modelSize: string;
  resolution: string;
  numFrames: number;
  guidanceScale: number;
  numInferenceSteps: number;
  timestamp: number;
}

export interface QuickPreset {
  prompt?: string;
  modelType: string;
  modelSize: string;
  resolution: string;
  numFrames: number;
  guidanceScale: number;
  numInferenceSteps: number;
  imageUrl?: string;
  timestamp: number;
}

/**
 * Save current settings
 */
export function saveSettings(settings: Omit<SavedSettings, 'timestamp'>): void {
  try {
    const savedSettings: SavedSettings = {
      ...settings,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSettings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * Load saved settings
 */
export function loadSettings(): SavedSettings | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

/**
 * Clear saved settings
 */
export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing settings:', error);
  }
}

/**
 * Save quick preset (빠른 프리셋)
 */
export function saveQuickPreset(preset: Omit<QuickPreset, 'timestamp'>): void {
  try {
    const quickPreset: QuickPreset = {
      ...preset,
      timestamp: Date.now(),
    };
    localStorage.setItem(QUICK_PRESET_KEY, JSON.stringify(quickPreset));
  } catch (error) {
    console.error('Error saving quick preset:', error);
  }
}

/**
 * Load quick preset (빠른 프리셋)
 */
export function loadQuickPreset(): QuickPreset | null {
  try {
    const stored = localStorage.getItem(QUICK_PRESET_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading quick preset:', error);
    return null;
  }
}

/**
 * Clear quick preset (빠른 프리셋 삭제)
 */
export function clearQuickPreset(): void {
  try {
    localStorage.removeItem(QUICK_PRESET_KEY);
  } catch (error) {
    console.error('Error clearing quick preset:', error);
  }
}

/**
 * Save selected preset ID (선택한 프리셋 ID 저장)
 */
export function saveSelectedPresetId(presetId: string): void {
  try {
    localStorage.setItem(SELECTED_PRESET_KEY, presetId);
  } catch (error) {
    console.error('Error saving selected preset ID:', error);
  }
}

/**
 * Load selected preset ID (선택한 프리셋 ID 불러오기)
 */
export function loadSelectedPresetId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PRESET_KEY);
  } catch (error) {
    console.error('Error loading selected preset ID:', error);
    return null;
  }
}

/**
 * Clear selected preset ID (선택한 프리셋 ID 삭제)
 */
export function clearSelectedPresetId(): void {
  try {
    localStorage.removeItem(SELECTED_PRESET_KEY);
  } catch (error) {
    console.error('Error clearing selected preset ID:', error);
  }
}

