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
  // const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE); // Reserved for future use

  // Ref for infinite scroll trigger
  // const loadMoreRef = useRef<HTMLDivElement>(null); // Reserved for future use

  // Fetch all videos (with pagination to get all)
  const { data: videos = [], isLoading, error, refetch } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      try {
        // 먼저 첫 페이지만 빠르게 가져오기 (성능 개선)
        const firstPage = await api.get<{ videos: Video[]; total: number; page: number; limit: number; total_pages: number }>('/api/v1/videos/list', {
          params: { page: 1, limit: 100 }, // Max limit is 100
          timeout: 5000, // 5초 타임아웃 (더 짧게 설정)
        });
        
        const allVideos = [...(firstPage.data.videos || [])];
        const totalPages = firstPage.data.total_pages || 1;
        
        // 나머지 페이지는 백그라운드에서 가져오기 (첫 페이지는 먼저 표시)
        if (totalPages > 1) {
          // 비동기로 나머지 페이지 가져오기 (에러가 나도 첫 페이지는 표시)
          Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              api.get<{ videos: Video[]; total: number; page: number; limit: number; total_pages: number }>('/api/v1/videos/list', {
                params: { page: i + 2, limit: 100 },
                timeout: 5000,
              }).catch(err => {
                console.warn(`Failed to fetch page ${i + 2}:`, err);
                return null;
              })
            )
          ).then(remainingPages => {
            const newVideos: Video[] = [];
            remainingPages.forEach((page) => {
              if (page?.data?.videos) {
                newVideos.push(...page.data.videos);
              }
            });
            if (newVideos.length > 0) {
              // 쿼리 캐시 업데이트
              queryClient.setQueryData(['videos'], [...allVideos, ...newVideos]);
            }
          }).catch(err => {
            console.warn('Failed to fetch remaining pages:', err);
          });
        }
        
        return allVideos;
      } catch (err: any) {
        console.error('Failed to fetch videos:', err);
        const errorMessage = err?.response?.data?.detail || err?.message || '비디오 목록을 불러오는데 실패했습니다';
        toast.error(errorMessage);
        throw err;
      }
    },
    refetchInterval: (query) => {
      // 데이터가 없거나 에러가 있으면 refetch 안 함
      if (!query.state.data || query.state.error) {
        return false;
      }
      // 처리 중이거나 대기 중인 비디오가 있으면 3초마다, 없으면 갱신 안 함
      const hasProcessing = query.state.data?.some(v => v.status === 'processing' || v.status === 'queued');
      return hasProcessing ? 3000 : false;
    },
    retry: 1, // 1번만 재시도 (너무 많이 재시도하면 로딩이 길어짐)
    retryDelay: 1000, // 1초 대기 후 재시도
    staleTime: 5000, // 5초간 데이터를 fresh로 간주
    gcTime: 30000, // 30초 후 캐시 삭제
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

  const handleDelete = async (videoId: string, videoStatus?: string) => {
    // 실패한 비디오는 확인 없이 바로 삭제
    if (videoStatus !== 'failed') {
      if (!confirm('이 비디오를 삭제하시겠습니까?')) {
      return;
      }
    }

    try {
      await api.delete(`/api/v1/videos/${videoId}`);
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast.success('비디오가 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast.error('비디오 삭제에 실패했습니다');
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
          <p className="font-semibold mb-2">비디오를 불러올 수 없습니다.</p>
          <p className="text-sm mb-4">
            {error instanceof Error ? error.message : '서버 연결 오류가 발생했습니다.'}
            {error instanceof Error && error.message.includes('timeout') && ' (요청 시간 초과)'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }
  
  // 로딩 중일 때 더 명확한 메시지 표시
  if (isLoading && videos.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">비디오 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">비디오 갤러리</h2>
        <p className="text-gray-600">
          {filteredAndSortedVideos.length}개의 비디오
          {hasActiveFilters && ` (전체 ${videos.length}개 중 필터링됨)`}
        </p>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프롬프트 검색
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="프롬프트로 검색..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Model Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              모델 유형
            </label>
            <select
              value={filters.modelType}
              onChange={(e) =>
                setFilters({ ...filters, modelType: e.target.value as ModelType | 'all' })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">모든 유형</option>
              <option value="t2v">T2V (텍스트-투-비디오)</option>
              <option value="i2v">I2V (이미지-투-비디오)</option>
              <option value="df">DF (확산 강제)</option>
            </select>
          </div>

          {/* Resolution Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              해상도
            </label>
            <select
              value={filters.resolution}
              onChange={(e) => setFilters({ ...filters, resolution: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">모든 해상도</option>
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
              상태
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value as VideoStatus | 'all' })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">모든 상태</option>
              <option value="completed">완료됨</option>
              <option value="processing">처리 중</option>
              <option value="queued">대기 중</option>
              <option value="failed">실패</option>
            </select>
          </div>
        </div>

        {/* Sort and Reset */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">정렬:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="status">상태순</option>
              <option value="model-type">모델 유형순</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              필터 초기화
            </button>
          )}

          <div className="ml-auto text-sm text-gray-600">
            {videos.filter((v) => v.status === 'processing').length > 0 && (
              <span className="flex items-center">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                {videos.filter((v) => v.status === 'processing').length}개 처리 중
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 mb-4">비디오 목록을 불러오는 중...</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
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
            {hasActiveFilters ? '필터에 맞는 비디오가 없습니다' : '아직 비디오가 없습니다'}
          </h3>
          <p className="text-gray-600">
            {hasActiveFilters
              ? '필터를 조정해보세요'
              : '첫 번째 비디오를 생성하면 여기에 표시됩니다'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              필터 지우기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={() => handleDelete(video.id, video.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
