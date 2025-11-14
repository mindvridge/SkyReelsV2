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

            {/* Progress Bar */}
            {(video.status === 'queued' || video.status === 'processing') && (
              <Progress value={video.progress} />
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
