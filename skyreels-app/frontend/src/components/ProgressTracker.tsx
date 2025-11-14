/**
 * Progress tracker component for video generation
 */

import React from 'react';
import { useVideoStatus } from '@/hooks/useVideoStatus';
import { useVideoStore } from '@/store/videoStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { getStatusColor, getStatusText } from '@/lib/utils';
import { notifyVideoComplete, notifyVideoFailed } from '@/store/notificationStore';
import { Loader2, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cancelVideo } from '@/services/api';

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

const formatElapsedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}초`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}분 ${secs}초`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}시간 ${minutes}분`;
  }
};

export const ProgressTracker: React.FC = () => {
  const { currentJobId, setCurrentJobId, setSelectedVideo } = useVideoStore();
  const [isCancelling, setIsCancelling] = React.useState(false);

  const { video, isLoading, isUsingWebSocket } = useVideoStatus({
    jobId: currentJobId,
    enabled: !!currentJobId,
    onComplete: (video) => {
      toast.success('비디오 생성이 완료되었습니다!');
      notifyVideoComplete(video.prompt || 'Your video');
      setSelectedVideo(video);
    },
    onError: (video) => {
      toast.error(`비디오 생성 실패: ${video.error_message}`);
      notifyVideoFailed(video.prompt || 'Your video', video.error_message);
    },
  });

  if (!currentJobId) {
    return null;
  }

  const getStatusIcon = () => {
    if (!video) return <Loader2 className="h-5 w-5 animate-spin" />;

    switch (video.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            생성 진행 상황
          </CardTitle>
          {/* WebSocket Connection Indicator */}
          {isUsingWebSocket && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>실시간</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center text-gray-500">로딩 중...</div>
        ) : video ? (
          <>
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor(video.status)}`} />
              <span className="text-sm font-medium">{getStatusText(video.status)}</span>
            </div>

            {/* Progress Bar with Details */}
            {(video.status === 'queued' || video.status === 'processing') && (
              <div className="space-y-3">
                {/* 진행률 및 시간 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {video.progress}% 완료
                    </span>
                    {video.estimated_remaining_seconds !== undefined && video.estimated_remaining_seconds > 0 && (
                      <span className="text-gray-600 font-medium">
                        약 {formatRemainingTime(video.estimated_remaining_seconds)} 남음
                      </span>
                    )}
                  </div>
                  
                  {/* 경과 시간 및 남은 시간 상세 정보 */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    {(() => {
                      // elapsed_seconds가 없으면 created_at 기준으로 계산
                      let elapsedSeconds = video.elapsed_seconds;
                      if (elapsedSeconds === undefined && video.created_at) {
                        // UTC 시간으로 파싱 (타임존 문제 해결)
                        const created = new Date(video.created_at + (video.created_at.endsWith('Z') ? '' : 'Z'));
                        const now = new Date();
                        elapsedSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);
                      }
                      // 음수이면 0으로, 9시간(32400초) 이상이면 0으로 표시
                      if (elapsedSeconds !== undefined) {
                        if (elapsedSeconds < 0 || elapsedSeconds > 32400) {
                          elapsedSeconds = 0;
                        }
                        return (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>경과 시간: {formatElapsedTime(elapsedSeconds)}</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>경과 시간: 0초</span>
                        </div>
                      );
                    })()}
                    {video.estimated_remaining_seconds !== undefined && 
                     video.estimated_remaining_seconds > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>남은 시간: {formatRemainingTime(video.estimated_remaining_seconds)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 진행률 바 */}
              <Progress value={video.progress} />
                
                {/* 상태 상세 정보 */}
                <div className="flex items-center justify-between mt-1">
                  {video.status_detail && (
                    <div className="text-xs text-gray-500">
                      {video.status_detail}
                    </div>
                  )}
                  {/* Device Badge */}
                  {video.device && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${
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
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">프롬프트:</div>
              <div className="text-sm text-gray-600">{video.prompt}</div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">모델:</span> {video.model_type.toUpperCase()}
              </div>
              <div>
                <span className="font-medium">크기:</span> {video.model_size}
              </div>
              <div>
                <span className="font-medium">해상도:</span> {video.resolution}
              </div>
              <div>
                <span className="font-medium">프레임:</span> {video.num_frames}
              </div>
              <div>
                <span className="font-medium">가이던스:</span> {video.guidance_scale}
              </div>
            </div>

            {/* Error Message */}
            {video.status === 'failed' && video.error_message && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                <strong>오류:</strong> {video.error_message}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {video.status === 'completed' && (
                <Button
                  onClick={() => setSelectedVideo(video)}
                  className="flex-1"
                >
                  비디오 보기
                </Button>
              )}
              {(video.status === 'queued' || video.status === 'processing') && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!currentJobId) return;
                    if (!confirm(`"${video.prompt?.substring(0, 50)}${video.prompt && video.prompt.length > 50 ? '...' : ''}"\n\n이 영상 생성을 취소하시겠습니까?`)) return;
                    
                    setIsCancelling(true);
                    try {
                      await cancelVideo(currentJobId);
                      toast.success('영상 생성이 취소되었습니다');
                      setCurrentJobId(null);
                    } catch (error: any) {
                      toast.error(`취소 실패: ${error.message}`);
                    } finally {
                      setIsCancelling(false);
                    }
                  }}
                  disabled={isCancelling}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  {isCancelling ? '취소 중...' : '생성 멈추기'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setCurrentJobId(null)}
              >
                {video.status === 'completed' || video.status === 'failed' ? '닫기' : '최소화'}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};
