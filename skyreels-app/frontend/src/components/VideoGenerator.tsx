/**
 * Video generation form component
 */

import React, { useState } from 'react';
import { useVideoStore } from '@/store/videoStore';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { VideoCreateRequest } from '@/types/video';

export const VideoGenerator: React.FC = () => {
  const { form, setForm, resetForm, setCurrentJobId } = useVideoStore();
  const { generateVideo, isGenerating, data } = useVideoGeneration();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!form.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    if (form.modelType === 'i2v' && !form.imageUrl.trim()) {
      alert('Please enter an image URL for Image-to-Video mode');
      return;
    }

    // Create request
    const request: VideoCreateRequest = {
      prompt: form.prompt,
      model_type: form.modelType,
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
          {/* Prompt */}
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
            <p className="text-xs text-gray-500">
              {form.prompt.length}/1000 characters
            </p>
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

          {/* Image URL for I2V */}
          {form.modelType === 'i2v' && (
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL *</Label>
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={form.imageUrl}
                onChange={(e) => setForm({ imageUrl: e.target.value })}
                required
              />
            </div>
          )}

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
