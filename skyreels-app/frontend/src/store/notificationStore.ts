/**
 * Notification Store
 * Manages notification settings and browser notifications
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationSettings {
  enabled: boolean;
  browserNotifications: boolean;
  soundNotifications: boolean;
  notifyOnComplete: boolean;
  notifyOnFail: boolean;
  soundVolume: number; // 0-1
}

interface NotificationState {
  settings: NotificationSettings;
  permission: NotificationPermission;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  requestPermission: () => Promise<void>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  playSound: () => void;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  browserNotifications: true,
  soundNotifications: false,
  notifyOnComplete: true,
  notifyOnFail: true,
  soundVolume: 0.5,
};

// Create notification sound
// Note: Sound is generated dynamically in playSound() function

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      requestPermission: async () => {
        if (typeof Notification === 'undefined') {
          console.warn('Browser notifications not supported');
          return;
        }

        if (Notification.permission === 'default') {
          try {
            const permission = await Notification.requestPermission();
            set({ permission });

            if (permission === 'granted') {
              // Show a test notification
              new Notification('SkyReels Notifications Enabled', {
                body: 'You will now receive notifications when your videos are ready!',
                icon: '/logo.png',
              });
            }
          } catch (error) {
            console.error('Failed to request notification permission:', error);
          }
        }
      },

      showNotification: (title, options = {}) => {
        const { settings, permission } = get();

        if (!settings.enabled || !settings.browserNotifications) {
          return;
        }

        if (typeof Notification === 'undefined' || permission !== 'granted') {
          console.warn('Notifications not available or not permitted');
          return;
        }

        try {
          const notification = new Notification(title, {
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'skyreels-notification',
            requireInteraction: false,
            ...options,
          });

          // Auto-close after 10 seconds
          setTimeout(() => notification.close(), 10000);

          // Focus window on click
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (error) {
          console.error('Failed to show notification:', error);
        }
      },

      playSound: () => {
        const { settings } = get();

        if (!settings.enabled || !settings.soundNotifications) {
          return;
        }

        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = 800;
          oscillator.type = 'sine';

          const volume = settings.soundVolume;
          gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
          console.error('Failed to play notification sound:', error);
        }
      },
    }),
    {
      name: 'skyreels-notification-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

/**
 * Hook to notify when a video is completed
 */
export const notifyVideoComplete = (videoPrompt: string) => {
  const store = useNotificationStore.getState();

  if (store.settings.notifyOnComplete) {
    store.showNotification('Video Generation Complete! 🎉', {
      body: `"${videoPrompt.substring(0, 100)}${videoPrompt.length > 100 ? '...' : ''}"`,
    });
    store.playSound();
  }
};

/**
 * Hook to notify when a video fails
 */
export const notifyVideoFailed = (videoPrompt: string, error?: string) => {
  const store = useNotificationStore.getState();

  if (store.settings.notifyOnFail) {
    store.showNotification('Video Generation Failed ❌', {
      body: error || `Failed to generate: "${videoPrompt.substring(0, 100)}${videoPrompt.length > 100 ? '...' : ''}"`,
    });
    store.playSound();
  }
};

/**
 * Calculate estimated completion time based on model and parameters
 */
export const estimateCompletionTime = (
  modelType: string,
  modelSize: string,
  resolution: string,
  numFrames: number,
  numInferenceSteps: number
): number => {
  // Base time in seconds (rough estimates)
  let baseTime = 60; // 1 minute base

  // Model size factor
  const sizeMultiplier = modelSize === '14B' ? 2.5 : 1.0;

  // Resolution factor
  const resolutionMultiplier = resolution === '720P' ? 1.5 : 1.0;

  // Frames factor (linear relationship)
  const framesMultiplier = numFrames / 49; // 49 frames as baseline

  // Inference steps factor
  const stepsMultiplier = numInferenceSteps / 30; // 30 steps as baseline

  // Model type factor
  const typeMultiplier = modelType === 'i2v' ? 0.8 : modelType === 'df' ? 1.2 : 1.0;

  const estimatedSeconds =
    baseTime *
    sizeMultiplier *
    resolutionMultiplier *
    framesMultiplier *
    stepsMultiplier *
    typeMultiplier;

  return Math.round(estimatedSeconds);
};

/**
 * Format time in seconds to human-readable string
 */
export const formatEstimatedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `~${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `~${minutes}m ${remainingSeconds}s`
      : `~${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `~${hours}h ${remainingMinutes}m`
    : `~${hours}h`;
};
