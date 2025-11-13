/**
 * Main application component
 */

import React, { useState } from 'react';
import { VideoGenerator } from '@/components/VideoGenerator';
import { ProgressTracker } from '@/components/ProgressTracker';
import { VideoGallery } from '@/components/VideoGallery';
import { VideoPlayer } from '@/components/VideoPlayer';
import { NotificationSettings } from '@/components/NotificationSettings';
import { useVideoStore } from '@/store/videoStore';
import { Sparkles, Settings } from 'lucide-react';

function App() {
  const { currentJobId } = useVideoStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  SkyReels V2
                </h1>
                <p className="text-sm text-gray-500">
                  AI-Powered Video Generation
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Generator */}
          <div className="lg:col-span-1">
            <VideoGenerator />
          </div>

          {/* Right Column - Progress & Gallery */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Tracker */}
            {currentJobId && <ProgressTracker />}

            {/* Video Gallery */}
            <VideoGallery />
          </div>
        </div>
      </main>

      {/* Video Player Modal */}
      <VideoPlayer />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <NotificationSettings />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>
            Powered by{' '}
            <a
              href="https://github.com/SkyworkAI/SkyReels-V2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              SkyReels V2
            </a>
            {' '}• World's First Open-Source Infinite-Length Video Generation Model
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
