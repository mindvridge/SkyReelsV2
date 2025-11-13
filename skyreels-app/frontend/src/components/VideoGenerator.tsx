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
import { ChevronDown, ChevronUp, Sparkles, Save, Clock, Trash2 } from 'lucide-react';
import type { VideoCreateRequest } from '@/types/video';
import { getAllPresets, getPresetById, savePreset, deletePreset, type VideoPreset } from '@/lib/presets';
import { getPromptHistory, addToPromptHistory, removeFromPromptHistory } from '@/lib/promptHistory';
import toast from 'react-hot-toast';

export const VideoGenerator: React.FC = () => {
  const { form, setForm, resetForm, setCurrentJobId } = useVideoStore();
  const { generateVideo, isGenerating, data } = useVideoGeneration();

  const [presets, setPresets] = useState(getAllPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [promptHistory, setPromptHistory] = useState(getPromptHistory());

  // Reload history when form changes
  useEffect(() => {
    setPromptHistory(getPromptHistory());
  }, [form.prompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!form.prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (form.modelType === 'i2v' && !form.imageUrl.trim()) {
      toast.error('Please provide an image for Image-to-Video mode');
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
      toast.success(`Loaded preset: ${preset.name}`);
    }
  };

  // Save current settings as preset
  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
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
      toast.success(`Preset saved: ${newPreset.name}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save preset');
    }
  };

  // Delete preset
  const handleDeletePreset = () => {
    if (!selectedPresetId) return;

    const preset = getPresetById(selectedPresetId);
    if (preset?.isDefault) {
      toast.error('Cannot delete default presets');
      return;
    }

    if (confirm(`Delete preset "${preset?.name}"?`)) {
      try {
        deletePreset(selectedPresetId);
        setPresets(getAllPresets());
        setSelectedPresetId('');
        toast.success('Preset deleted');
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete preset');
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
    toast.success('Removed from history');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-600" />
          Generate Video
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Presets */}
          <div className="space-y-2">
            <Label htmlFor="preset">Quick Presets</Label>
            <div className="flex gap-2">
              <Select
                id="preset"
                value={selectedPresetId}
                onChange={(e) => handleLoadPreset(e.target.value)}
                className="flex-1"
              >
                <option value="">-- Select a preset --</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} {preset.isDefault ? '' : '(Custom)'}
                  </option>
                ))}
              </Select>
              {selectedPresetId && !getPresetById(selectedPresetId)?.isDefault && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeletePreset}
                  title="Delete preset"
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

          {/* Prompt with History */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt *</Label>
            <Input
              id="prompt"
              type="text"
              placeholder="Describe the video you want to generate..."
              value={form.prompt}
              onChange={(e) => setForm({ prompt: e.target.value })}
              required
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {form.prompt.length}/1000 characters
              </p>
              {promptHistory.length > 0 && (
                <details className="relative">
                  <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Recent prompts ({promptHistory.length})
                  </summary>
                  <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {promptHistory.map((item, index) => (
                      <div
                        key={index}
                        className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 group"
                        onClick={() => handleLoadPrompt(item.prompt)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-700 flex-1 line-clamp-2">
                            {item.prompt}
                          </p>
                          <button
                            onClick={(e) => handleRemoveFromHistory(e, item.prompt)}
                            className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Model Type */}
          <div className="space-y-2">
            <Label htmlFor="modelType">Model Type</Label>
            <Select
              id="modelType"
              value={form.modelType}
              onChange={(e) => setForm({ modelType: e.target.value as any })}
            >
              <option value="t2v">Text-to-Video (T2V)</option>
              <option value="i2v">Image-to-Video (I2V)</option>
              <option value="df">Diffusion Forcing (DF) - Infinite Length</option>
            </Select>
          </div>

          {/* Image Upload for I2V */}
          {form.modelType === 'i2v' && (
            <div className="space-y-2">
              <Label>Input Image *</Label>
              <ImageUploader
                onUpload={(url) => setForm({ imageUrl: url })}
                currentImage={form.imageUrl}
                onClear={() => setForm({ imageUrl: '' })}
              />
            </div>
          )}

          {/* Model Size */}
          <div className="space-y-2">
            <Label htmlFor="modelSize">Model Size</Label>
            <Select
              id="modelSize"
              value={form.modelSize}
              onChange={(e) => setForm({ modelSize: e.target.value as any })}
            >
              <option value="14B">14B (~51GB VRAM, Higher Quality)</option>
              <option value="1.3B">1.3B (~15GB VRAM, Faster)</option>
            </Select>
            <p className="text-xs text-gray-500">
              {form.modelSize === '14B'
                ? '14B model requires A100 80GB or similar GPU'
                : '1.3B model works on RTX 3090/4090 (24GB VRAM)'}
            </p>
          </div>

          {/* Resolution */}
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution</Label>
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
              Advanced Options
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
                      Save Current Settings as Preset
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Preset name..."
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
                        Save
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
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Number of Frames */}
                <div className="space-y-2">
                  <Label htmlFor="numFrames">
                    Number of Frames: {form.numFrames}
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
                    More frames = longer video (97-193)
                  </p>
                </div>

                {/* Guidance Scale */}
                <div className="space-y-2">
                  <Label htmlFor="guidanceScale">
                    Guidance Scale: {form.guidanceScale.toFixed(1)}
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
                    Higher values = more adherence to prompt (1-20)
                  </p>
                </div>

                {/* Inference Steps */}
                <div className="space-y-2">
                  <Label htmlFor="numInferenceSteps">
                    Inference Steps: {form.numInferenceSteps}
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
                    More steps = better quality but slower (10-100)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isGenerating} className="flex-1">
              {isGenerating ? 'Generating...' : 'Generate Video'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={isGenerating}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
