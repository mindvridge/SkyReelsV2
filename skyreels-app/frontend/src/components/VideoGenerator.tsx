/**
 * Video generation form component with presets, history, and image upload
 */

import React, { useState, useEffect } from 'react';
import { useVideoStore } from '@/store/videoStore';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ImageUploader } from '@/components/ImageUploader';
import { AdvancedPromptEditor } from '@/components/AdvancedPromptEditor';
import { ChevronDown, ChevronUp, Sparkles, Save, Clock, Trash2, X } from 'lucide-react';
import type { VideoCreateRequest } from '@/types/video';
import { getAllPresets, getPresetById, savePreset, deletePreset } from '@/lib/presets';
import { getPromptHistory, addToPromptHistory, removeFromPromptHistory } from '@/lib/promptHistory';
import { saveSettings, loadSettings, clearSettings, saveQuickPreset, loadQuickPreset, clearQuickPreset, saveSelectedPresetId, loadSelectedPresetId, clearSelectedPresetId } from '@/lib/settingsStorage';
import { estimateCompletionTime, formatEstimatedTime } from '@/store/notificationStore';
import toast from 'react-hot-toast';

export const VideoGenerator: React.FC = () => {
  const { form, setForm, resetForm, setCurrentJobId } = useVideoStore();
  const { generateVideo, isGenerating, data } = useVideoGeneration();

  const [presets, setPresets] = useState(getAllPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [promptHistory, setPromptHistory] = useState(getPromptHistory());
  const [useAdvancedEditor, setUseAdvancedEditor] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [hasQuickPreset, setHasQuickPreset] = useState(!!loadQuickPreset());

  // Load saved settings and quick preset on mount
  React.useEffect(() => {
    // 먼저 빠른 프리셋 확인 (우선순위 높음)
    const quickPreset = loadQuickPreset();
    if (quickPreset) {
      setForm({
        prompt: quickPreset.prompt || '',
        modelType: quickPreset.modelType as any,
        modelSize: quickPreset.modelSize as any,
        resolution: quickPreset.resolution as any,
        numFrames: quickPreset.numFrames,
        guidanceScale: quickPreset.guidanceScale,
        numInferenceSteps: quickPreset.numInferenceSteps,
        imageUrl: quickPreset.imageUrl || '',
      });
      setHasQuickPreset(true);
      toast.success('빠른 프리셋이 자동으로 불러와졌습니다');
    } else {
      // 빠른 프리셋이 없으면 선택한 프리셋 확인
      const savedPresetId = loadSelectedPresetId();
      if (savedPresetId) {
        const preset = getPresetById(savedPresetId);
        if (preset) {
          setForm({
            modelType: preset.modelType,
            modelSize: preset.modelSize,
            resolution: preset.resolution,
            numFrames: preset.numFrames,
            guidanceScale: preset.guidanceScale,
            numInferenceSteps: preset.numInferenceSteps,
          });
          setSelectedPresetId(savedPresetId);
          toast.success(`프리셋 "${preset.name}"이 자동으로 불러와졌습니다`);
        }
      } else {
        // 프리셋도 없으면 일반 설정 불러오기
        const saved = loadSettings();
        if (saved) {
          setForm({
            modelType: saved.modelType as any,
            modelSize: saved.modelSize as any,
            resolution: saved.resolution as any,
            numFrames: saved.numFrames,
            guidanceScale: saved.guidanceScale,
            numInferenceSteps: saved.numInferenceSteps,
          });
        }
      }
      setHasQuickPreset(false);
    }
  }, []);

  // Save settings when form changes
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveSettings({
        modelType: form.modelType,
        modelSize: form.modelSize,
        resolution: form.resolution,
        numFrames: form.numFrames,
        guidanceScale: form.guidanceScale,
        numInferenceSteps: form.numInferenceSteps,
      });
    }, 1000); // Debounce: save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [form.modelType, form.modelSize, form.resolution, form.numFrames, form.guidanceScale, form.numInferenceSteps]);

  // Calculate estimated completion time
  const estimatedTime = estimateCompletionTime(
    form.modelType,
    form.modelSize,
    form.resolution,
    form.numFrames,
    form.numInferenceSteps
  );

  // Reload history when form changes
  useEffect(() => {
    setPromptHistory(getPromptHistory());
  }, [form.prompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!form.prompt.trim()) {
      toast.error('프롬프트를 입력해주세요');
      return;
    }

    if (form.modelType === 'i2v' && !form.imageUrl.trim()) {
      toast.error('이미지-투-비디오 모드에는 이미지가 필요합니다');
      return;
    }

    // Add to history
    addToPromptHistory(form.prompt);

    // Create request
    const request: VideoCreateRequest = {
      prompt: form.prompt,
      model_type: form.modelType,
      model_size: form.modelSize,
      resolution: form.resolution,
      num_frames: form.numFrames,
      guidance_scale: form.guidanceScale,
      num_inference_steps: form.numInferenceSteps,
      image_url: form.modelType === 'i2v' ? form.imageUrl : undefined,
    };

    // Generate video
    generateVideo(request);
  };

  // Track current job when generated
  React.useEffect(() => {
    if (data) {
      setCurrentJobId(data.job_id);
    }
  }, [data, setCurrentJobId]);

  // Load preset
  const handleLoadPreset = (presetId: string) => {
    if (!presetId) {
      setSelectedPresetId('');
      clearSelectedPresetId();
      return;
    }

    const preset = getPresetById(presetId);
    if (preset) {
      setForm({
        modelType: preset.modelType,
        modelSize: preset.modelSize,
        resolution: preset.resolution,
        numFrames: preset.numFrames,
        guidanceScale: preset.guidanceScale,
        numInferenceSteps: preset.numInferenceSteps,
      });
      setSelectedPresetId(presetId);
      saveSelectedPresetId(presetId); // 선택한 프리셋 ID 저장
      toast.success(`프리셋 로드됨: ${preset.name}`);
    }
  };

  // Save current settings as preset
  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error('프리셋 이름을 입력해주세요');
      return;
    }

    try {
      const newPreset = savePreset({
        name: presetName.trim(),
        description: `Custom preset: ${form.modelSize} ${form.resolution}`,
        modelType: form.modelType,
        modelSize: form.modelSize,
        resolution: form.resolution,
        numFrames: form.numFrames,
        guidanceScale: form.guidanceScale,
        numInferenceSteps: form.numInferenceSteps,
      });

      setPresets(getAllPresets());
      setPresetName('');
      setShowSavePreset(false);
      setSelectedPresetId(newPreset.id);
      toast.success(`프리셋 저장됨: ${newPreset.name}`);
    } catch (error: any) {
      toast.error(error.message || '프리셋 저장에 실패했습니다');
    }
  };

  // Delete preset
  const handleDeletePreset = () => {
    if (!selectedPresetId) return;

    const preset = getPresetById(selectedPresetId);
    if (preset?.isDefault) {
      toast.error('기본 프리셋은 삭제할 수 없습니다');
      return;
    }

    if (confirm(`프리셋 "${preset?.name}"을(를) 삭제하시겠습니까?`)) {
      try {
        deletePreset(selectedPresetId);
        setPresets(getAllPresets());
        setSelectedPresetId('');
        toast.success('프리셋이 삭제되었습니다');
      } catch (error: any) {
        toast.error(error.message || '프리셋 삭제에 실패했습니다');
      }
    }
  };

  // Load prompt from history
  const handleLoadPrompt = (prompt: string) => {
    setForm({ prompt });
  };

  // Remove from history
  const handleRemoveFromHistory = (e: React.MouseEvent, prompt: string) => {
    e.stopPropagation();
    removeFromPromptHistory(prompt);
    setPromptHistory(getPromptHistory());
    toast.success('히스토리에서 제거되었습니다');
  };

  // Save quick preset (빠른 프리셋 저장)
  const handleSaveQuickPreset = () => {
    try {
      saveQuickPreset({
        prompt: form.prompt,
        modelType: form.modelType,
        modelSize: form.modelSize,
        resolution: form.resolution,
        numFrames: form.numFrames,
        guidanceScale: form.guidanceScale,
        numInferenceSteps: form.numInferenceSteps,
        imageUrl: form.imageUrl,
      });
      setHasQuickPreset(true);
      toast.success('빠른 프리셋이 저장되었습니다. 다음에 접속하면 자동으로 불러옵니다.');
    } catch (error) {
      console.error('Error saving quick preset:', error);
      toast.error('빠른 프리셋 저장에 실패했습니다');
    }
  };

  // Clear quick preset (빠른 프리셋 삭제)
  const handleClearQuickPreset = () => {
    if (confirm('빠른 프리셋을 삭제하시겠습니까?')) {
      clearQuickPreset();
      setHasQuickPreset(false);
      toast.success('빠른 프리셋이 삭제되었습니다');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-600" />
          비디오 생성
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="preset">빠른 프리셋</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveQuickPreset}
                  title="현재 설정을 빠른 프리셋으로 저장 (다음 접속 시 자동 불러오기)"
                >
                  <Save className="h-4 w-4 mr-1" />
                  빠른 프리셋 저장
                </Button>
                {hasQuickPreset && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearQuickPreset}
                    title="저장된 빠른 프리셋 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                id="preset"
                value={selectedPresetId}
                onChange={(e) => handleLoadPreset(e.target.value)}
                className="flex-1"
              >
                <option value="">-- 프리셋 선택 --</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} {preset.isDefault ? '' : '(사용자 정의)'}
                  </option>
                ))}
              </Select>
              {selectedPresetId && !getPresetById(selectedPresetId)?.isDefault && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeletePreset}
                  title="프리셋 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedPresetId && (
              <p className="text-xs text-gray-500">
                {getPresetById(selectedPresetId)?.description}
              </p>
            )}
          </div>

          {/* Prompt with Advanced Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt">프롬프트 *</Label>
              <button
                type="button"
                onClick={() => setUseAdvancedEditor(!useAdvancedEditor)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {useAdvancedEditor ? '간단한 편집기' : '고급 편집기'}
                <ChevronDown className={`h-3 w-3 transform transition-transform ${useAdvancedEditor ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {useAdvancedEditor ? (
              <AdvancedPromptEditor
                value={form.prompt}
                onChange={(prompt) => setForm({ prompt })}
                modelType={form.modelType}
              />
            ) : (
              <>
                <Input
                  id="prompt"
                  type="text"
                  placeholder="생성하고 싶은 비디오를 설명하세요..."
                  value={form.prompt}
                  onChange={(e) => setForm({ prompt: e.target.value })}
                  required
                  maxLength={1000}
                />
                <div className="flex items-center justify-between relative">
                  <p className="text-xs text-gray-500">
                    {form.prompt.length}/1000 글자
                  </p>
                  {promptHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPromptHistory(!showPromptHistory)}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      최근 프롬프트 ({promptHistory.length})
                    </button>
                  )}
                  {showPromptHistory && promptHistory.length > 0 && (
                    <div className="absolute right-0 top-6 w-80 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                      <div className="p-2 border-b flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">프롬프트 히스토리</span>
                        <button
                          onClick={() => setShowPromptHistory(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {promptHistory.map((item, index) => (
                        <div
                          key={index}
                          className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 group"
                          onClick={() => {
                            handleLoadPrompt(item.prompt);
                            setShowPromptHistory(false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-700 flex-1 line-clamp-2">
                              {item.prompt}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromHistory(e, item.prompt);
                              }}
                              className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Model Type */}
          <div className="space-y-2">
            <Label htmlFor="modelType">모델 유형</Label>
            <Select
              id="modelType"
              value={form.modelType}
              onChange={(e) => setForm({ modelType: e.target.value as any })}
            >
              <option value="t2v">텍스트-투-비디오 (T2V)</option>
              <option value="i2v">이미지-투-비디오 (I2V)</option>
              <option value="df">확산 강제 (DF) - 무한 길이</option>
            </Select>
          </div>

          {/* Image Upload for I2V */}
          {form.modelType === 'i2v' && (
            <div className="space-y-2">
              <Label>입력 이미지 *</Label>
              <ImageUploader
                onUpload={(url) => setForm({ imageUrl: url })}
                currentImage={form.imageUrl}
                onClear={() => setForm({ imageUrl: '' })}
              />
            </div>
          )}

          {/* Model Size */}
          <div className="space-y-2">
            <Label htmlFor="modelSize">모델 크기</Label>
            <Select
              id="modelSize"
              value={form.modelSize}
              onChange={(e) => setForm({ modelSize: e.target.value as any })}
            >
              <option value="14B">14B (~51GB VRAM, 더 높은 품질)</option>
              <option value="1.3B">1.3B (~15GB VRAM, 더 빠름)</option>
            </Select>
            <p className="text-xs text-gray-500">
              {form.modelSize === '14B'
                ? '14B 모델은 A100 80GB 또는 유사한 GPU가 필요합니다'
                : '1.3B 모델은 RTX 3090/4090 (24GB VRAM)에서 작동합니다'}
            </p>
          </div>

          {/* Resolution */}
          <div className="space-y-2">
            <Label htmlFor="resolution">해상도</Label>
            <Select
              id="resolution"
              value={form.resolution}
              onChange={(e) => setForm({ resolution: e.target.value as any })}
            >
              <option value="540P">540P (960x540)</option>
              <option value="720P">720P (1280x720)</option>
            </Select>
          </div>

          {/* Advanced Options */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setForm({ showAdvanced: !form.showAdvanced })}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {form.showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              고급 옵션
            </button>

            {form.showAdvanced && (
              <div className="mt-4 space-y-4">
                {/* Save Preset Button */}
                <div>
                  {!showSavePreset ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSavePreset(true)}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      현재 설정을 프리셋으로 저장
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="프리셋 이름..."
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSavePreset();
                          }
                        }}
                      />
                      <Button type="button" size="sm" onClick={handleSavePreset}>
                        저장
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowSavePreset(false);
                          setPresetName('');
                        }}
                      >
                        취소
                      </Button>
                    </div>
                  )}
                </div>

                {/* Number of Frames */}
                <div className="space-y-2">
                  <Label htmlFor="numFrames">
                    프레임 수: {form.numFrames}
                  </Label>
                  <input
                    id="numFrames"
                    type="range"
                    min="97"
                    max="193"
                    step="1"
                    value={form.numFrames}
                    onChange={(e) => setForm({ numFrames: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    프레임이 많을수록 비디오가 길어집니다 (97-193)
                  </p>
                </div>

                {/* Guidance Scale */}
                <div className="space-y-2">
                  <Label htmlFor="guidanceScale">
                    가이던스 스케일: {form.guidanceScale.toFixed(1)}
                  </Label>
                  <input
                    id="guidanceScale"
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={form.guidanceScale}
                    onChange={(e) => setForm({ guidanceScale: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    값이 높을수록 프롬프트에 더 충실합니다 (1-20)
                  </p>
                </div>

                {/* Inference Steps */}
                <div className="space-y-2">
                  <Label htmlFor="numInferenceSteps">
                    추론 단계: {form.numInferenceSteps}
                  </Label>
                  <input
                    id="numInferenceSteps"
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={form.numInferenceSteps}
                    onChange={(e) => setForm({ numInferenceSteps: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    단계가 많을수록 품질이 좋아지지만 느려집니다 (10-100)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Estimated Time */}
          {!isGenerating && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-lg p-3">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>
                예상 생성 시간: <strong className="text-blue-700">{formatEstimatedTime(estimatedTime)}</strong>
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isGenerating} className="flex-1">
              {isGenerating ? '생성 중...' : '비디오 생성'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (confirm('설정을 초기화하시겠습니까? 저장된 설정도 삭제됩니다.')) {
                  clearSettings();
                  resetForm();
                  toast.success('설정이 초기화되었습니다');
                }
              }}
              disabled={isGenerating}
            >
              초기화
            </Button>
          </div>
          
          {/* Settings Info */}
          <div className="text-xs text-gray-500 text-center">
            설정은 자동으로 저장됩니다
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
