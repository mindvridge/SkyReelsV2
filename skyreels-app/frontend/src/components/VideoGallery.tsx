/**
 * VideoGallery Component
 * Grid view of all videos with filtering and sorting
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { handleApiError } from '@/lib/axios';
import { Video, ModelType, VideoStatus } from '@/types/video';
import { VideoCard } from '@/components/VideoCard';
import toast from 'react-hot-toast';

type SortOption = 'newest' | 'oldest' | 'status' | 'model-type';

interface FilterState {
  modelType: ModelType | 'all';
  resolution: string;
  status: VideoStatus | 'all';
  search: string;
}

const ITEMS_PER_PAGE = 12; // Show 12 videos at a time

export const VideoGallery: React.FC = () => {
  const queryClient = useQueryClient();

  // Filter and sort state
  const [filters, setFilters] = useState<FilterState>({
    modelType: 'all',
    resolution: 'all',
    status: 'all',
    search: '',
  });
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);

  // Ref for infinite scroll trigger
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch all videos
  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const response = await api.get<Video[]>('/api/v1/videos');
      return response.data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Filter and sort videos
  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];

    // Apply filters
    if (filters.modelType !== 'all') {
      result = result.filter((v) => v.model_type === filters.modelType);
    }

    if (filters.resolution !== 'all') {
      result = result.filter((v) => v.resolution === filters.resolution);
    }

    if (filters.status !== 'all') {
      result = result.filter((v) => v.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((v) =>
        v.prompt?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'status':
        const statusOrder = { completed: 0, processing: 1, queued: 2, failed: 3 };
        result.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
      case 'model-type':
        result.sort((a, b) => a.model_type.localeCompare(b.model_type));
        break;
    }

    return result;
  }, [videos, filters, sortBy]);

  // Get unique resolutions from videos
  const availableResolutions = useMemo(() => {
    const resolutions = new Set(videos.map((v) => v.resolution));
    return Array.from(resolutions).sort();
  }, [videos]);

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await api.delete(`/api/v1/videos/${videoId}`);
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast.success('Video deleted successfully');
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast.error('Failed to delete video');
    }
  };

  const resetFilters = () => {
    setFilters({
      modelType: 'all',
      resolution: 'all',
      status: 'all',
      search: '',
    });
    setSortBy('newest');
  };

  const hasActiveFilters =
    filters.modelType !== 'all' ||
    filters.resolution !== 'all' ||
    filters.status !== 'all' ||
    filters.search !== '' ||
    sortBy !== 'newest';

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load videos. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Video Gallery</h2>
        <p className="text-gray-600">
          {filteredAndSortedVideos.length} video{filteredAndSortedVideos.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` (filtered from ${videos.length} total)`}
        </p>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Prompts
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by prompt..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Model Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Type
            </label>
            <select
              value={filters.modelType}
              onChange={(e) =>
                setFilters({ ...filters, modelType: e.target.value as ModelType | 'all' })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="t2v">T2V (Text-to-Video)</option>
              <option value="i2v">I2V (Image-to-Video)</option>
              <option value="df">DF (Diffusion Forcing)</option>
            </select>
          </div>

          {/* Resolution Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resolution
            </label>
            <select
              value={filters.resolution}
              onChange={(e) => setFilters({ ...filters, resolution: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Resolutions</option>
              {availableResolutions.map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value as VideoStatus | 'all' })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Sort and Reset */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">Status</option>
              <option value="model-type">Model Type</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto text-sm text-gray-600">
            {videos.filter((v) => v.status === 'processing').length > 0 && (
              <span className="flex items-center">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                {videos.filter((v) => v.status === 'processing').length} processing
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredAndSortedVideos.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {hasActiveFilters ? 'No videos match your filters' : 'No videos yet'}
          </h3>
          <p className="text-gray-600">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Generate your first video to see it here'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={() => handleDelete(video.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
