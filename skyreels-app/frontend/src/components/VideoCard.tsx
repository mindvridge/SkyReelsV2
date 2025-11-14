/**
 * VideoCard Component
 * Displays a single video with thumbnail and hover preview
 */

import React, { useState, useRef } from 'react';
import { Video } from '@/types/video';
import { formatDate, getStatusColor, getStatusText } from '@/lib/utils';

// 시간 포맷팅 유틸리티 함수
const formatRemainingTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}초`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}분 ${secs}초` : `${minutes}분`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }
};

interface VideoCardProps {
  video: Video;
  onClick?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onClick,
  onDelete,
  showActions = true,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [, setTick] = useState(0); // 강제 리렌더링을 위한 state
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // 처리 중이거나 대기 중일 때 1초마다 리렌더링하여 경과 시간을 실시간 업데이트
  React.useEffect(() => {
    if (video.status === 'processing' || video.status === 'queued') {
      const interval = setInterval(() => {
        setTick(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [video.status]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current && video.status === 'completed') {
      videoRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const getVideoUrl = () => {
    if (video.video_url) {
      return video.video_url.startsWith('http')
        ? video.video_url
        : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${video.video_url}`;
    }
    return '';
  };

  return (
    <div
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Preview Area */}
      <div className="relative aspect-video bg-gray-900">
        {video.status === 'completed' && video.video_url ? (
          <>
            <video
              ref={videoRef}
              src={getVideoUrl()}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
            />
            {/* Play Overlay when not hovering */}
            {!isHovering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                <svg
                  className="w-16 h-16 text-white opacity-80"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            )}
          </>
        ) : video.status === 'processing' || video.status === 'queued' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-white text-sm font-medium mb-2">
              {video.status === 'queued' ? '대기 중...' : '처리 중...'}
            </p>
            
            {/* 진행률 퍼센트 - queued/processing 상태에서도 표시 */}
            <div className="w-full max-w-xs space-y-2">
              {/* 진행률 및 시간 정보 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-white text-xs mb-1">
                  <span className="font-semibold">
                    {(() => {
                      if (video.status === 'queued') {
                        return '대기 중...';
                      } else if (video.progress > 0) {
                        return `${video.progress}% 완료`;
                      } else {
                        return '시작 중...';
                      }
                    })()}
                  </span>
                  {video.estimated_remaining_seconds !== undefined && 
                   video.estimated_remaining_seconds > 0 && (
                    <span className="text-gray-300">
                      약 {formatRemainingTime(video.estimated_remaining_seconds)} 남음
                    </span>
                  )}
                </div>
                
                {/* 경과 시간 정보 - 항상 실시간 계산 */}
                <div className="flex items-center justify-center text-gray-300 text-xs">
                  {(() => {
                    // 항상 created_at 기준으로 실시간 계산 (1초마다 갱신됨)
                    if (video.created_at) {
                      // UTC 시간으로 파싱 (타임존 문제 해결)
                      const created = new Date(video.created_at + (video.created_at.endsWith('Z') ? '' : 'Z'));
                      const now = new Date();
                      let elapsedSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);
                      
                      // 음수이면 0으로, 9시간(32400초) 이상이면 0으로 표시
                      if (elapsedSeconds < 0 || elapsedSeconds > 32400) {
                        elapsedSeconds = 0;
                      }
                      
                      return (
                        <span className="text-gray-400">
                          경과: {formatRemainingTime(elapsedSeconds)}
                        </span>
                      );
                    }
                    // created_at이 없으면 0초 표시
                    return (
                      <span className="text-gray-400">
                        경과: 0초
                      </span>
                    );
                  })()}
                </div>
              </div>
              
              {/* 진행률 바 - queued/processing 상태에서도 최소 1% 표시 */}
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(video.progress || 0, 1)}%` }}
                ></div>
              </div>
              
              {/* 상세 정보 */}
              {video.status_detail ? (
                <p className="text-gray-300 text-xs text-center mt-1">
                  {video.status_detail}
                </p>
              ) : video.status === 'queued' ? (
                <p className="text-gray-300 text-xs text-center mt-1">
                  작업이 시작되기를 기다리고 있습니다...
                </p>
              ) : video.status === 'processing' && video.progress === 0 ? (
                <p className="text-gray-300 text-xs text-center mt-1">
                  작업을 시작하고 있습니다...
                </p>
              ) : null}
            </div>
          </div>
        ) : video.status === 'failed' ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <svg
              className="w-12 h-12 text-red-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-500 text-sm">생성 실패</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm">미리보기 없음</p>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 right-2 flex gap-1">
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(
              video.status
            )}`}
          >
            {getStatusText(video.status)}
          </span>
          {/* Device Badge - Show only when processing */}
          {video.status === 'processing' && video.device && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${
                video.device === 'mps'
                  ? 'bg-purple-600'
                  : video.device === 'cuda'
                  ? 'bg-green-600'
                  : 'bg-gray-600'
              }`}
              title={video.device === 'mps' ? 'Apple Silicon GPU 사용 중' : video.device === 'cuda' ? 'NVIDIA GPU 사용 중' : 'CPU 사용 중'}
            >
              {video.device.toUpperCase()}
            </span>
          )}
        </div>

        {/* Model Info Badge */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-600 text-white">
            {video.model_type.toUpperCase()}
          </span>
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white">
            {video.model_size}
          </span>
        </div>
      </div>

      {/* Video Info */}
      <div className="p-4">
        {/* Prompt */}
        <p className="text-sm text-gray-800 mb-2 line-clamp-2 font-medium">
          {video.prompt || '프롬프트 없음'}
        </p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-2">
          <span className="flex items-center">
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {video.resolution}
          </span>
          <span className="flex items-center">
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
            {video.num_frames}f
          </span>
          {video.guidance_scale && (
            <span className="flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              CFG {video.guidance_scale}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center text-xs text-gray-500">
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {formatDate(video.created_at)}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="mt-3 flex gap-2">
            {video.status === 'completed' && video.video_url && (
              <a
                href={getVideoUrl()}
                download
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                다운로드
              </a>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
