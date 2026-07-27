import { createProgress, normalizeProgress, type QuizProgress } from './quiz'

export const STORAGE_KEY = 'kaoyan-english-progress-v1'

export function loadProgress(ids: string[]): QuizProgress {
  if (typeof window === 'undefined') return createProgress(ids)

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return normalizeProgress(saved ? JSON.parse(saved) : null, ids)
  } catch {
    return createProgress(ids)
  }
}

export function saveProgress(progress: QuizProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // The quiz remains usable when storage is blocked or full.
  }
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // There is nothing else to recover when storage is unavailable.
  }
}
