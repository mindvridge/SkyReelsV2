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
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export const ProgressTracker: React.FC = () => {
  const { currentJobId, setCurrentJobId, setSelectedVideo } = useVideoStore();

  const { video, isLoading } = useVideoStatus({
    jobId: currentJobId,
    enabled: !!currentJobId,
    onComplete: (video) => {
      toast.success('Video generation completed!');
      setSelectedVideo(video);
    },
    onError: (video) => {
      toast.error(`Video generation failed: ${video.error_message}`);
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
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Generation Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center text-gray-500">Loading...</div>
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
              <div className="text-sm font-medium text-gray-700">Prompt:</div>
              <div className="text-sm text-gray-600">{video.prompt}</div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Model:</span> {video.model_type.toUpperCase()}
              </div>
              <div>
                <span className="font-medium">Size:</span> {video.model_size}
              </div>
              <div>
                <span className="font-medium">Resolution:</span> {video.resolution}
              </div>
              <div>
                <span className="font-medium">Frames:</span> {video.num_frames}
              </div>
              <div>
                <span className="font-medium">Guidance:</span> {video.guidance_scale}
              </div>
            </div>

            {/* Error Message */}
            {video.status === 'failed' && video.error_message && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                <strong>Error:</strong> {video.error_message}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {video.status === 'completed' && (
                <Button
                  onClick={() => setSelectedVideo(video)}
                  className="flex-1"
                >
                  View Video
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setCurrentJobId(null)}
              >
                {video.status === 'completed' || video.status === 'failed' ? 'Close' : 'Minimize'}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};
