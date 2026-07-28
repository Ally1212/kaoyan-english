import type { ExamLibrary } from './vocabularyBank'
import type { WordTrainingMode } from './vocabularyQuiz'

export const MISTAKE_STORAGE_KEY = 'kaoyan-english-mistakes-v1'
export const MAX_MISTAKE_RECORDS = 500

export type TrainingMode = WordTrainingMode | 'reading'
export type MistakeStatus = '待复习' | '巩固中' | '已掌握'
export type ReviewStage = 0 | 1 | 2 | 3

const validExams = new Set<ExamLibrary>(['cet4', 'cet6', 'ky', 'ielts', 'toefl'])
const validModes = new Set<TrainingMode>(['word-zh', 'word-en', 'reading'])
const validStatuses = new Set<MistakeStatus>(['待复习', '巩固中', '已掌握'])

export interface MistakeAttempt {
  key: string
  itemId: string
  exam: ExamLibrary
  mode: TrainingMode
  prompt: string
  selectedAnswer: string
  correctAnswer: string
  explanation: string
}

export interface MistakeRecord extends MistakeAttempt {
  wrongCount: number
  lastWrongAt: string
  reviewStage: ReviewStage
  nextReviewAt: string
  lastReviewedAt?: string
  status: MistakeStatus
}

export interface ReviewQueueItem extends MistakeAttempt {
  reviewOrigin: '本轮' | '历史'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function addDays(value: string, days: number): string {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function isMistakeRecord(value: unknown): value is MistakeRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<MistakeRecord>

  return isNonEmptyString(record.key)
    && isNonEmptyString(record.itemId)
    && validExams.has(record.exam as ExamLibrary)
    && validModes.has(record.mode as TrainingMode)
    && isNonEmptyString(record.prompt)
    && isNonEmptyString(record.selectedAnswer)
    && isNonEmptyString(record.correctAnswer)
    && isNonEmptyString(record.explanation)
    && Number.isInteger(record.wrongCount)
    && Number(record.wrongCount) > 0
    && isIsoDate(record.lastWrongAt)
    && Number.isInteger(record.reviewStage)
    && Number(record.reviewStage) >= 0
    && Number(record.reviewStage) <= 3
    && isIsoDate(record.nextReviewAt)
    && (record.lastReviewedAt === undefined || isIsoDate(record.lastReviewedAt))
    && validStatuses.has(record.status as MistakeStatus)
    && (
      (record.reviewStage === 0 && record.status === '待复习')
      || ((record.reviewStage === 1 || record.reviewStage === 2) && record.status === '巩固中')
      || (record.reviewStage === 3 && record.status === '已掌握')
    )
}

export function buildReviewQueue(
  currentRound: readonly ReviewQueueItem[],
  records: readonly MistakeRecord[],
  exam: ExamLibrary,
  mode: TrainingMode,
  availableItemIds: readonly string[],
  limit = 5,
  now: string = new Date().toISOString(),
): ReviewQueueItem[] {
  const queue = currentRound.slice(0, limit)
  const seen = new Set(queue.map((item) => item.key))
  const availableItems = new Set(availableItemIds)
  const statusRank: Record<MistakeStatus, number> = { 待复习: 0, 巩固中: 1, 已掌握: 2 }

  const historical = records
    .filter((record) => (
      record.exam === exam
      && record.mode === mode
      && availableItems.has(record.itemId)
      && record.status !== '已掌握'
      && record.nextReviewAt <= now
      && !seen.has(record.key)
    ))
    .sort((left, right) => (
      statusRank[left.status] - statusRank[right.status]
      || right.wrongCount - left.wrongCount
      || left.nextReviewAt.localeCompare(right.nextReviewAt)
      || right.lastWrongAt.localeCompare(left.lastWrongAt)
    ))

  for (const record of historical) {
    if (seen.has(record.key)) continue
    queue.push({ ...record, reviewOrigin: '历史' })
    seen.add(record.key)
    if (queue.length >= limit) break
  }

  return queue
}

export function recordMistake(
  records: readonly MistakeRecord[],
  attempt: MistakeAttempt,
  now: string = new Date().toISOString(),
): MistakeRecord[] {
  const existing = records.find((record) => record.key === attempt.key)
  const next: MistakeRecord = existing
    ? {
        ...existing,
        ...attempt,
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: now,
        reviewStage: 0,
        nextReviewAt: now,
        status: '待复习',
      }
    : {
        ...attempt,
        wrongCount: 1,
        lastWrongAt: now,
        reviewStage: 0,
        nextReviewAt: now,
        status: '待复习',
      }

  return [next, ...records.filter((record) => record.key !== attempt.key)]
    .slice(0, MAX_MISTAKE_RECORDS)
}

export function applyReviewResult(
  records: readonly MistakeRecord[],
  key: string,
  correct: boolean,
  now: string = new Date().toISOString(),
): MistakeRecord[] {
  return records.map((record) => {
    if (record.key !== key) return record
    if (!correct) {
      return {
        ...record,
        reviewStage: 0,
        nextReviewAt: now,
        lastReviewedAt: now,
        status: '待复习',
      }
    }

    const reviewStage = Math.min(record.reviewStage + 1, 3) as ReviewStage
    const intervalDays = reviewStage === 1 ? 1 : reviewStage === 2 ? 3 : 7
    return {
      ...record,
      reviewStage,
      nextReviewAt: addDays(now, intervalDays),
      lastReviewedAt: now,
      status: reviewStage === 3 ? '已掌握' : '巩固中',
    }
  })
}

export function loadMistakes(): MistakeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(MISTAKE_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []

    const seen = new Set<string>()
    return value
      .filter((record): record is MistakeRecord => {
        if (!isMistakeRecord(record) || seen.has(record.key)) return false
        seen.add(record.key)
        return true
      })
      .slice(0, MAX_MISTAKE_RECORDS)
  } catch {
    return []
  }
}

export function saveMistakes(records: readonly MistakeRecord[]): void {
  try {
    window.localStorage.setItem(
      MISTAKE_STORAGE_KEY,
      JSON.stringify(records.slice(0, MAX_MISTAKE_RECORDS)),
    )
  } catch {
    // Training continues when storage is blocked or full.
  }
}

export function clearMistakes(): void {
  try {
    window.localStorage.removeItem(MISTAKE_STORAGE_KEY)
  } catch {
    // Nothing else needs to be recovered.
  }
}
