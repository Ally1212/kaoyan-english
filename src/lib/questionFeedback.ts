export const QUESTION_FEEDBACK_STORAGE_KEY = 'kaoyan-english-question-feedback-v1'

export interface QuestionFeedbackRecord {
  questionId: string
  reportedAt: string
}

function isValidRecord(value: unknown): value is QuestionFeedbackRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<QuestionFeedbackRecord>

  const reportedAt = typeof record.reportedAt === 'string' ? new Date(record.reportedAt) : null
  return typeof record.questionId === 'string'
    && /^[a-zA-Z0-9_-]{1,64}$/.test(record.questionId)
    && typeof record.reportedAt === 'string'
    && reportedAt !== null
    && Number.isFinite(reportedAt.getTime())
    && reportedAt.toISOString() === record.reportedAt
}

export function loadQuestionFeedback(): QuestionFeedbackRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(QUESTION_FEEDBACK_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value.filter((record): record is QuestionFeedbackRecord => {
      if (!isValidRecord(record) || seen.has(record.questionId)) return false
      seen.add(record.questionId)
      return true
    })
  } catch {
    return []
  }
}

export function saveQuestionFeedback(records: readonly QuestionFeedbackRecord[]): void {
  try {
    window.localStorage.setItem(QUESTION_FEEDBACK_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Training continues when storage is blocked or full.
  }
}

export function clearQuestionFeedback(): void {
  try {
    window.localStorage.removeItem(QUESTION_FEEDBACK_STORAGE_KEY)
  } catch {
    // Nothing else needs to be recovered.
  }
}

export function toggleQuestionFeedback(
  records: readonly QuestionFeedbackRecord[],
  questionId: string,
  now: string = new Date().toISOString(),
): QuestionFeedbackRecord[] {
  if (records.some((record) => record.questionId === questionId)) {
    return records.filter((record) => record.questionId !== questionId)
  }

  return [{ questionId, reportedAt: now }, ...records]
}
