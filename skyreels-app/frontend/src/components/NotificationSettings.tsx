/**
 * NotificationSettings Component
 * UI for configuring notification preferences
 */

import React, { useEffect } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import toast from 'react-hot-toast';

export const NotificationSettings: React.FC = () => {
  const { settings, permission, updateSettings, requestPermission } = useNotificationStore();

  useEffect(() => {
    // Update permission state when component mounts
    if (typeof Notification !== 'undefined') {
      useNotificationStore.setState({ permission: Notification.permission });
    }
  }, []);

  const handleEnableChange = (enabled: boolean) => {
    updateSettings({ enabled });
    if (enabled && permission === 'default') {
      requestPermission();
    }
  };

  const handleBrowserNotificationsChange = (browserNotifications: boolean) => {
    if (browserNotifications && permission !== 'granted') {
      requestPermission();
    }
    updateSettings({ browserNotifications });
  };

  const handleTestNotification = () => {
    const store = useNotificationStore.getState();
    store.showNotification('Test Notification 🔔', {
      body: 'This is how your notifications will look!',
    });
    store.playSound();
    toast.success('Test notification sent!');
  };

  const handleTestSound = () => {
    const store = useNotificationStore.getState();
    store.playSound();
    toast.success('Test sound played!');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Notification Settings</h3>
        <button
          onClick={handleTestNotification}
          disabled={!settings.enabled || permission !== 'granted'}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Test Notification
        </button>
      </div>

      <div className="space-y-6">
        {/* Master Enable Switch */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <label className="text-sm font-medium text-gray-900">Enable Notifications</label>
            <p className="text-xs text-gray-500 mt-1">
              Turn all notifications on or off
            </p>
          </div>
          <button
            onClick={() => handleEnableChange(!settings.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Browser Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-900">Browser Notifications</label>
            <p className="text-xs text-gray-500 mt-1">
              Show desktop notifications
              {permission === 'denied' && (
                <span className="text-red-600 ml-1">(Permission denied)</span>
              )}
              {permission === 'default' && (
                <span className="text-yellow-600 ml-1">(Permission not requested)</span>
              )}
            </p>
          </div>
          <button
            onClick={() => handleBrowserNotificationsChange(!settings.browserNotifications)}
            disabled={!settings.enabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.browserNotifications && settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.browserNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Sound Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-900">Sound Notifications</label>
            <p className="text-xs text-gray-500 mt-1">Play a sound when notifications appear</p>
          </div>
          <button
            onClick={() => updateSettings({ soundNotifications: !settings.soundNotifications })}
            disabled={!settings.enabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.soundNotifications && settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.soundNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Sound Volume */}
        {settings.soundNotifications && (
          <div>
            <label className="text-sm font-medium text-gray-900 block mb-2">
              Sound Volume: {Math.round(settings.soundVolume * 100)}%
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.soundVolume * 100}
                onChange={(e) =>
                  updateSettings({ soundVolume: parseInt(e.target.value) / 100 })
                }
                disabled={!settings.enabled}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
              />
              <button
                onClick={handleTestSound}
                disabled={!settings.enabled}
                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Test
              </button>
            </div>
          </div>
        )}

        {/* Notify on Complete */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">Notify on Completion</label>
            <p className="text-xs text-gray-500 mt-1">
              Get notified when video generation completes
            </p>
          </div>
          <button
            onClick={() => updateSettings({ notifyOnComplete: !settings.notifyOnComplete })}
            disabled={!settings.enabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.notifyOnComplete && settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.notifyOnComplete ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Notify on Fail */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">Notify on Failure</label>
            <p className="text-xs text-gray-500 mt-1">
              Get notified when video generation fails
            </p>
          </div>
          <button
            onClick={() => updateSettings({ notifyOnFail: !settings.notifyOnFail })}
            disabled={!settings.enabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.notifyOnFail && settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.notifyOnFail ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Request Permission Button */}
        {permission !== 'granted' && settings.enabled && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 mb-3">
              {permission === 'denied'
                ? 'Browser notifications are blocked. Please enable them in your browser settings.'
                : 'Browser notifications require permission to work.'}
            </p>
            {permission === 'default' && (
              <button
                onClick={requestPermission}
                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors"
              >
                Request Permission
              </button>
            )}
          </div>
        )}

        {/* Success Message */}
        {permission === 'granted' && settings.enabled && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-green-800">
                Notifications are enabled and working!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
