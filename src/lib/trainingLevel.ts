import type { Question, QuestionLevel } from '../data/questions'
import type { ExamLibrary } from './vocabularyBank'

export const TRAINING_LEVEL_STORAGE_KEY = 'kaoyan-english-training-level-v1'
export const trainingLevels = ['全部', '基础', '进阶', '挑战'] as const

export type TrainingLevel = '全部' | QuestionLevel

const validLevels = new Set<TrainingLevel>(trainingLevels)

export function getQuestionIdsForLevel(
  questions: readonly Question[],
  level: TrainingLevel,
): string[] {
  return questions
    .filter((question) => level === '全部' || question.level === level)
    .map((question) => question.id)
}

export function getQuestionIdsForExamLevel(
  questions: readonly Question[],
  exam: ExamLibrary,
  level: TrainingLevel,
): string[] {
  return questions
    .filter((question) => (
      (question.exams ? question.exams.includes(exam) : exam === 'ky')
      && (level === '全部' || question.level === level)
    ))
    .map((question) => question.id)
}

export function loadTrainingLevel(): TrainingLevel {
  if (typeof window === 'undefined') return '全部'

  try {
    const saved = window.localStorage.getItem(TRAINING_LEVEL_STORAGE_KEY)
    return saved && validLevels.has(saved as TrainingLevel) ? saved as TrainingLevel : '全部'
  } catch {
    return '全部'
  }
}

export function saveTrainingLevel(level: TrainingLevel): void {
  try {
    window.localStorage.setItem(TRAINING_LEVEL_STORAGE_KEY, level)
  } catch {
    // The level selector remains usable when browser storage is unavailable.
  }
}
