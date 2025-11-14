/**
 * Video player modal component
 */

import React from 'react';
import { useVideoStore } from '@/store/videoStore';
import { Button } from '@/components/ui/Button';
import { X, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const VideoPlayer: React.FC = () => {
  const { selectedVideo, setSelectedVideo } = useVideoStore();

  if (!selectedVideo) {
    return null;
  }

  const handleClose = () => {
    setSelectedVideo(null);
  };

  const handleDownload = () => {
    if (selectedVideo.video_url) {
      window.open(selectedVideo.video_url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b p-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">생성된 비디오</h2>
            <p className="text-sm text-gray-500 mt-1">{selectedVideo.prompt}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video */}
        <div className="p-4">
          <video
            src={selectedVideo.video_url}
            controls
            autoPlay
            loop
            className="w-full rounded-lg"
          >
            브라우저가 비디오 재생을 지원하지 않습니다.
          </video>
        </div>

        {/* Details */}
        <div className="border-t p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">모델:</span> {selectedVideo.model_type.toUpperCase()}
            </div>
            <div>
              <span className="font-medium">해상도:</span> {selectedVideo.resolution}
            </div>
            <div>
              <span className="font-medium">프레임:</span> {selectedVideo.num_frames}
            </div>
            <div>
              <span className="font-medium">가이던스 스케일:</span> {selectedVideo.guidance_scale}
            </div>
            <div className="col-span-2">
              <span className="font-medium">생성일:</span> {formatDate(selectedVideo.created_at)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t p-4">
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            다운로드
          </Button>
          <Button variant="outline" onClick={handleClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
};
