/**
 * Image uploader component for I2V mode
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ImageUploaderProps {
  onUpload: (imageUrl: string) => void;
  currentImage?: string;
  onClear?: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onUpload,
  currentImage,
  onClear,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('잘못된 파일 형식입니다. JPG, PNG, WebP 또는 GIF를 업로드해주세요.');
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('파일이 너무 큽니다. 최대 크기는 10MB입니다.');
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/v1/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { image_url, dimensions } = response.data;

      onUpload(image_url);
      toast.success(`이미지 업로드 완료 (${dimensions.width}x${dimensions.height})`);
    } catch (error: any) {
      console.error('Upload error:', error);
      const message = error.response?.data?.detail || '이미지 업로드에 실패했습니다';
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Current Image Preview */}
      {currentImage && (
        <div className="relative rounded-lg border-2 border-gray-200 overflow-hidden">
          <img
            src={currentImage}
            alt="Uploaded preview"
            className="w-full h-48 object-cover"
          />
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      {!currentImage && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleChange}
            disabled={isUploading}
          />

          <div className="space-y-4">
            <div className="flex justify-center">
              {isUploading ? (
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
              ) : (
                <ImageIcon className="h-12 w-12 text-gray-400" />
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900">
                {isUploading ? '업로드 중...' : '이미지를 여기에 드롭하세요'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                또는 아래 버튼을 클릭하세요
              </p>
            </div>

            <Button
              type="button"
              onClick={handleButtonClick}
              disabled={isUploading}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              이미지 선택
            </Button>

            <p className="text-xs text-gray-500">
              JPG, PNG, WebP, GIF (max 10MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
