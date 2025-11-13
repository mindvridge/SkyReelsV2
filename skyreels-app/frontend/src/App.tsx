/**
 * Main application component
 */

import React from 'react';
import { VideoGenerator } from '@/components/VideoGenerator';
import { ProgressTracker } from '@/components/ProgressTracker';
import { VideoGallery } from '@/components/VideoGallery';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useVideoStore } from '@/store/videoStore';
import { Sparkles } from 'lucide-react';

function App() {
  const { currentJobId } = useVideoStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
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
