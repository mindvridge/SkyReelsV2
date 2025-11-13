/**
 * AdvancedPromptEditor Component
 * Advanced prompt editing with templates, keywords, and guidance
 */

import React, { useState, useEffect } from 'react';
import { ModelType } from '../types/video';
import {
  PROMPT_TEMPLATES,
  KEYWORD_CATEGORIES,
  PROMPT_TIPS,
  getTemplatesByModelType,
  getAllCategories,
  validatePrompt,
  applyTemplate,
} from '../lib/promptTemplates';

interface AdvancedPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  modelType: ModelType;
  placeholder?: string;
}

export const AdvancedPromptEditor: React.FC<AdvancedPromptEditorProps> = ({
  value,
  onChange,
  modelType,
  placeholder = 'Describe the video you want to generate...',
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const templates = getTemplatesByModelType(modelType);
  const validation = validatePrompt(value);

  // Get validation color
  const getValidationColor = () => {
    if (!validation.valid) return 'text-red-600';
    if (validation.severity === 'warning') return 'text-yellow-600';
    if (validation.severity === 'info') return 'text-blue-600';
    return 'text-gray-600';
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      // If prompt is empty, use template directly
      if (!value.trim()) {
        onChange(template.template);
      } else {
        // Append template to existing prompt
        onChange(value + '\n\n' + template.template);
      }
      setShowTemplates(false);
    }
  };

  // Handle keyword insertion
  const handleKeywordInsert = (keyword: string) => {
    if (!value.trim()) {
      onChange(keyword);
    } else {
      // Add keyword with comma separator
      onChange(value + (value.endsWith(',') ? ' ' : ', ') + keyword);
    }
  };

  // Calculate character statistics
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const recommendedMin = 20;
  const recommendedMax = 300;

  return (
    <div className="space-y-3">
      {/* Main Textarea */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm"
        />

        {/* Character/Word Count */}
        <div className="absolute bottom-2 right-2 flex items-center gap-3 text-xs">
          <span
            className={`px-2 py-1 rounded ${
              charCount < recommendedMin
                ? 'bg-yellow-100 text-yellow-700'
                : charCount > recommendedMax
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {charCount} chars
          </span>
          <span className="text-gray-600">{wordCount} words</span>
        </div>
      </div>

      {/* Validation Message */}
      {validation.message && (
        <div className={`text-sm ${getValidationColor()} flex items-start gap-2`}>
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>{validation.message}</span>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
          Templates
        </button>

        <button
          onClick={() => setShowKeywords(!showKeywords)}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          Keywords
        </button>

        <button
          onClick={() => setShowTips(!showTips)}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Tips
        </button>

        <button
          onClick={() => onChange('')}
          disabled={!value}
          className="ml-auto px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            Prompt Templates ({templates.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className="p-3 bg-white rounded border border-gray-200 hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-1">
                  <h5 className="font-medium text-gray-900 text-sm">{template.name}</h5>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {template.category}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                <p className="text-xs text-gray-500 font-mono line-clamp-2">
                  {template.template}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords Panel */}
      {showKeywords && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            Quick Keywords
          </h4>
          <div className="space-y-4">
            {KEYWORD_CATEGORIES.map((category) => (
              <div key={category.name}>
                <button
                  onClick={() =>
                    setSelectedCategory(selectedCategory === category.name ? null : category.name)
                  }
                  className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 mb-2 hover:text-blue-600"
                >
                  <span>{category.name}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${
                      selectedCategory === category.name ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {selectedCategory === category.name && (
                  <div className="flex flex-wrap gap-2">
                    {category.keywords.map((keyword) => (
                      <button
                        key={keyword}
                        onClick={() => handleKeywordInsert(keyword)}
                        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips Panel */}
      {showTips && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h4 className="font-semibold text-green-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Prompt Writing Tips
          </h4>
          <ul className="space-y-2 text-sm text-green-800">
            {PROMPT_TIPS.map((tip, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2 flex-shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress Bar (visual indicator of prompt length) */}
      <div className="relative h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            charCount < recommendedMin
              ? 'bg-yellow-500'
              : charCount > recommendedMax
              ? 'bg-orange-500'
              : 'bg-green-500'
          }`}
          style={{
            width: `${Math.min((charCount / recommendedMax) * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  );
};
