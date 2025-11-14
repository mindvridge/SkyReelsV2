/**
 * Main application component
 */

import React, { useState, useEffect } from 'react';
import { VideoGenerator } from '@/components/VideoGenerator';
import { ProgressTracker } from '@/components/ProgressTracker';
import { VideoGallery } from '@/components/VideoGallery';
import { VideoPlayer } from '@/components/VideoPlayer';
import { NotificationSettings } from '@/components/NotificationSettings';
import { useVideoStore } from '@/store/videoStore';
import { setupNetworkMonitoring } from '@/lib/axios';
import { Sparkles, Settings, StopCircle } from 'lucide-react';
import { cancelAllVideos } from '@/services/api';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { listVideos } from '@/services/api';
import toast from 'react-hot-toast';

function App() {
  const { currentJobId, setCurrentJobId } = useVideoStore();
  const [showSettings, setShowSettings] = useState(false);
  const [isCancellingAll, setIsCancellingAll] = useState(false);
  const queryClient = useQueryClient();

  // Check for active jobs
  const { data: videosData } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const firstPage = await listVideos(1, 100);
      return firstPage.videos || [];
    },
    refetchInterval: 5000, // Check every 5 seconds
  });

  const activeJobsCount = (videosData || []).filter(
    (v) => v.status === 'queued' || v.status === 'processing'
  ).length;

  // Setup network monitoring on mount
  useEffect(() => {
    setupNetworkMonitoring();
  }, []);

  const handleCancelAll = async () => {
    if (activeJobsCount === 0) {
      toast('취소할 진행 중인 작업이 없습니다', { icon: 'ℹ️' });
      return;
    }

    if (!confirm(`진행 중인 ${activeJobsCount}개의 영상 생성을 모두 취소하시겠습니까?`)) {
      return;
    }

    setIsCancellingAll(true);
    try {
      const response = await cancelAllVideos();
      toast.success(response.message || '모든 진행 중인 작업이 취소되었습니다');
      // Refresh video list and clear current job
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setCurrentJobId(null);
    } catch (error: any) {
      toast.error(`전체 취소 실패: ${error.message}`);
    } finally {
      setIsCancellingAll(false);
    }
  };

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
                  AI 기반 비디오 생성
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeJobsCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-medium">
                  {activeJobsCount}개 진행 중
                </div>
              )}
              <button
                onClick={handleCancelAll}
                disabled={isCancellingAll || activeJobsCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={activeJobsCount === 0 ? '진행 중인 작업이 없습니다' : '모든 진행 중인 영상 생성 취소'}
              >
                <StopCircle className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {isCancellingAll ? '취소 중...' : '전체 멈추기'}
                </span>
              </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-700" />
                <span className="text-sm font-medium text-gray-700">설정</span>
            </button>
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

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">설정</h2>
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
            {' '}• 세계 최초 오픈소스 무한 길이 비디오 생성 모델
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
