/**
 * Prompt Templates and Keywords
 * Provides templates and common keywords for video generation
 */

import { ModelType } from '../types/video';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  modelType: ModelType | 'all';
  template: string;
  keywords: string[];
}

export interface KeywordCategory {
  name: string;
  keywords: string[];
}

// Prompt Templates
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'cinematic',
    name: 'Cinematic Scene',
    description: 'High-quality cinematic video',
    category: 'Style',
    modelType: 'all',
    template: 'Cinematic shot of [SUBJECT], [LIGHTING], [CAMERA MOVEMENT], highly detailed, professional cinematography, 8K',
    keywords: ['dramatic lighting', 'shallow depth of field', 'film grain', 'anamorphic'],
  },
  {
    id: 'nature',
    name: 'Nature Documentary',
    description: 'Nature and wildlife scenes',
    category: 'Subject',
    modelType: 't2v',
    template: '[SUBJECT] in natural habitat, [TIME OF DAY], wildlife documentary style, National Geographic quality, 4K',
    keywords: ['golden hour', 'aerial view', 'close-up', 'slow motion'],
  },
  {
    id: 'product',
    name: 'Product Showcase',
    description: 'Professional product video',
    category: 'Commercial',
    modelType: 'all',
    template: 'Professional product video of [PRODUCT], rotating view, studio lighting, clean white background, commercial quality',
    keywords: ['360 rotation', 'macro shot', 'reflections', 'premium quality'],
  },
  {
    id: 'animation',
    name: 'Animated Style',
    description: '3D or 2D animation style',
    category: 'Style',
    modelType: 't2v',
    template: '[SUBJECT] in [ANIMATION STYLE] style, vibrant colors, smooth motion, Pixar quality',
    keywords: ['3D rendered', 'cartoon style', 'anime style', 'motion graphics'],
  },
  {
    id: 'scifi',
    name: 'Sci-Fi Scene',
    description: 'Science fiction environment',
    category: 'Genre',
    modelType: 't2v',
    template: 'Futuristic sci-fi scene with [SUBJECT], neon lights, cyberpunk aesthetic, highly detailed, 8K',
    keywords: ['holographic', 'futuristic city', 'space station', 'advanced technology'],
  },
  {
    id: 'timelapse',
    name: 'Time-lapse',
    description: 'Time-lapse video effect',
    category: 'Effect',
    modelType: 't2v',
    template: 'Time-lapse of [SUBJECT], [DURATION], smooth motion, high quality',
    keywords: ['sunset to night', 'clouds moving', 'city traffic', 'flowers blooming'],
  },
  {
    id: 'action',
    name: 'Action Scene',
    description: 'Dynamic action sequences',
    category: 'Genre',
    modelType: 'all',
    template: 'Dynamic action shot of [SUBJECT], [ACTION], fast motion, cinematic camera work, intense atmosphere',
    keywords: ['explosive', 'chase scene', 'fight sequence', 'dramatic music'],
  },
  {
    id: 'abstract',
    name: 'Abstract Art',
    description: 'Abstract visual art',
    category: 'Style',
    modelType: 't2v',
    template: 'Abstract [STYLE] art, [COLORS], flowing motion, mesmerizing patterns, artistic',
    keywords: ['fluid simulation', 'particle effects', 'geometric shapes', 'psychedelic'],
  },
];

// Keyword Categories for quick insertion
export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    name: 'Camera',
    keywords: [
      'aerial view',
      'close-up shot',
      'wide angle',
      'dolly zoom',
      'tracking shot',
      'crane shot',
      'handheld camera',
      'steady cam',
      'first person view',
      'bird eye view',
    ],
  },
  {
    name: 'Lighting',
    keywords: [
      'golden hour',
      'soft lighting',
      'dramatic lighting',
      'studio lighting',
      'neon lights',
      'natural light',
      'backlit',
      'rim lighting',
      'volumetric lighting',
      'god rays',
    ],
  },
  {
    name: 'Quality',
    keywords: [
      '8K resolution',
      '4K quality',
      'highly detailed',
      'photorealistic',
      'ultra HD',
      'professional quality',
      'sharp focus',
      'crystal clear',
    ],
  },
  {
    name: 'Motion',
    keywords: [
      'slow motion',
      'fast motion',
      'smooth motion',
      'dynamic movement',
      'flowing',
      'rotating',
      'panning',
      'zooming',
    ],
  },
  {
    name: 'Atmosphere',
    keywords: [
      'cinematic',
      'dramatic',
      'peaceful',
      'energetic',
      'mysterious',
      'epic',
      'moody',
      'vibrant',
      'dreamy',
      'intense',
    ],
  },
  {
    name: 'Effects',
    keywords: [
      'depth of field',
      'motion blur',
      'lens flare',
      'film grain',
      'color grading',
      'vignette',
      'bokeh',
      'chromatic aberration',
    ],
  },
];

// Common phrases and modifiers
export const QUALITY_MODIFIERS = [
  'highly detailed',
  'professional quality',
  'masterpiece',
  'award-winning',
  'trending on artstation',
  'photorealistic',
  '8K resolution',
  'ultra HD',
];

export const STYLE_MODIFIERS = [
  'cinematic',
  'dramatic',
  'artistic',
  'professional',
  'commercial quality',
  'documentary style',
  'studio production',
  'high-end',
];

/**
 * Get templates by model type
 */
export const getTemplatesByModelType = (modelType: ModelType): PromptTemplate[] => {
  return PROMPT_TEMPLATES.filter(
    (t) => t.modelType === modelType || t.modelType === 'all'
  );
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category: string): PromptTemplate[] => {
  return PROMPT_TEMPLATES.filter((t) => t.category === category);
};

/**
 * Get all unique categories
 */
export const getAllCategories = (): string[] => {
  const categories = new Set(PROMPT_TEMPLATES.map((t) => t.category));
  return Array.from(categories).sort();
};

/**
 * Apply template with placeholders
 */
export const applyTemplate = (template: string, replacements: Record<string, string>): string => {
  let result = template;
  Object.entries(replacements).forEach(([key, value]) => {
    const placeholder = `[${key.toUpperCase()}]`;
    result = result.replace(placeholder, value);
  });
  return result;
};

/**
 * Validate prompt length and provide feedback
 */
export const validatePrompt = (
  prompt: string
): { valid: boolean; message?: string; severity?: 'info' | 'warning' | 'error' } => {
  const length = prompt.length;

  if (length === 0) {
    return { valid: false, message: 'Prompt cannot be empty', severity: 'error' };
  }

  if (length < 20) {
    return {
      valid: true,
      message: 'Prompt is quite short. Consider adding more details for better results.',
      severity: 'warning',
    };
  }

  if (length > 500) {
    return {
      valid: true,
      message: 'Prompt is very long. Some details might be ignored.',
      severity: 'warning',
    };
  }

  if (length > 300) {
    return {
      valid: true,
      message: 'Prompt is getting long. Consider focusing on key details.',
      severity: 'info',
    };
  }

  return { valid: true };
};

/**
 * Get prompt writing tips
 */
export const PROMPT_TIPS = [
  'Start with the main subject, then add details about lighting, camera angle, and quality.',
  'Use specific descriptive words rather than generic ones (e.g., "sunset over ocean" vs "nice scene").',
  'Mention the desired style or mood (cinematic, documentary, artistic, etc.).',
  'Include technical details like resolution (4K, 8K) and camera movements for better results.',
  'Use commas to separate different aspects of your prompt for clarity.',
  'For I2V mode, describe how you want the image to animate rather than describing the image itself.',
  'Avoid contradictory descriptions (e.g., "bright and dark" or "fast and slow").',
  'More specific prompts generally produce better results than vague descriptions.',
];
