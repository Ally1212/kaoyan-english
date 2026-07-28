import type { TrainingLevel } from './trainingLevel'
import type { TrainingMode } from './mistakes'
import type { ExamLibrary } from './vocabularyBank'

export const TRAINING_PREFERENCES_STORAGE_KEY = 'kaoyan-english-training-preferences-v1'

export interface TrainingPreferences {
  exam: ExamLibrary
  mode: TrainingMode
  level: TrainingLevel
}

export const defaultTrainingPreferences: TrainingPreferences = {
  exam: 'ky',
  mode: 'reading',
  level: '全部',
}

const exams = new Set<ExamLibrary>(['cet4', 'cet6', 'ky', 'ielts', 'toefl'])
const modes = new Set<TrainingMode>(['word-zh', 'word-en', 'reading'])
const levels = new Set<TrainingLevel>(['全部', '基础', '进阶', '挑战'])

export function loadTrainingPreferences(): TrainingPreferences {
  if (typeof window === 'undefined') return defaultTrainingPreferences
  try {
    const value = JSON.parse(window.localStorage.getItem(TRAINING_PREFERENCES_STORAGE_KEY) ?? '{}')
    if (
      value
      && exams.has(value.exam)
      && modes.has(value.mode)
      && levels.has(value.level)
    ) return value
  } catch {
    // Invalid preferences fall back to the stable default.
  }
  return defaultTrainingPreferences
}

export function saveTrainingPreferences(preferences: TrainingPreferences): void {
  try {
    window.localStorage.setItem(TRAINING_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // The current selection remains usable without persistence.
  }
}
