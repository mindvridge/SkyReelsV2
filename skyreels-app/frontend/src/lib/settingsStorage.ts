/**
 * Settings storage management
 */

const STORAGE_KEY = 'skyreels-settings';

export interface SavedSettings {
  modelType: string;
  modelSize: string;
  resolution: string;
  numFrames: number;
  guidanceScale: number;
  numInferenceSteps: number;
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

