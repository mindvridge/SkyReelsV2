/**
 * Video gallery component
 */

import React, { useState } from 'react';
import { useVideoList } from '@/hooks/useVideoList';
import { useVideoStore } from '@/store/videoStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { truncateText, formatDate, getStatusColor, getStatusText } from '@/lib/utils';
import { Grid, Play, Trash2, RefreshCw } from 'lucide-react';
import type { Video } from '@/types/video';

export const VideoGallery: React.FC = () => {
  const [page, setPage] = useState(1);
  const limit = 12;

  const { videos, total, totalPages, isLoading, refetch, deleteVideo, isDeleting } = useVideoList({
    page,
    limit,
  });

  const { setSelectedVideo, setCurrentJobId } = useVideoStore();

  const handleVideoClick = (video: Video) => {
    if (video.status === 'completed') {
      setSelectedVideo(video);
    } else {
      setCurrentJobId(video.id);
    }
  };

  const handleDelete = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this video?')) {
      deleteVideo(videoId);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Grid className="h-6 w-6 text-blue-600" />
            Video Gallery
            {total > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({total} total)
              </span>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && videos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Loading videos...
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No videos yet. Generate your first video!
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleVideoClick(video)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-100">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.prompt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">
                        <Play className="h-12 w-12" />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white ${getStatusColor(video.status)}`}>
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        {getStatusText(video.status)}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(e, video.id)}
                      disabled={isDeleting}
                      className="absolute top-2 right-2 rounded-full bg-red-600 p-2 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {/* Play Overlay */}
                    {video.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 transition-opacity group-hover:bg-opacity-30">
                        <Play className="h-12 w-12 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    )}

                    {/* Progress Bar */}
                    {(video.status === 'processing' || video.status === 'queued') && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${video.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {truncateText(video.prompt, 60)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{video.model_type.toUpperCase()} • {video.resolution}</span>
                      <span>{formatDate(video.created_at).split(',')[0]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isLoading}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
