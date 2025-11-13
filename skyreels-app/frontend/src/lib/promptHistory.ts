/**
 * Prompt history management
 */

const STORAGE_KEY = 'skyreels-prompt-history';
const MAX_HISTORY = 10;

export interface PromptHistoryItem {
  prompt: string;
  timestamp: number;
}

/**
 * Get prompt history
 */
export function getPromptHistory(): PromptHistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading prompt history:', error);
    return [];
  }
}

/**
 * Add prompt to history
 */
export function addToPromptHistory(prompt: string): void {
  if (!prompt || !prompt.trim()) return;

  const trimmedPrompt = prompt.trim();
  const history = getPromptHistory();

  // Remove if already exists
  const filtered = history.filter(item => item.prompt !== trimmedPrompt);

  // Add to beginning
  const newHistory: PromptHistoryItem[] = [
    { prompt: trimmedPrompt, timestamp: Date.now() },
    ...filtered,
  ];

  // Keep only MAX_HISTORY items
  const limited = newHistory.slice(0, MAX_HISTORY);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('Error saving prompt history:', error);
  }
}

/**
 * Clear prompt history
 */
export function clearPromptHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing prompt history:', error);
  }
}

/**
 * Remove specific prompt from history
 */
export function removeFromPromptHistory(prompt: string): void {
  const history = getPromptHistory();
  const filtered = history.filter(item => item.prompt !== prompt);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from prompt history:', error);
  }
}
