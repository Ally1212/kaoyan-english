export const SESSION_QUESTION_COUNT = 5
export const SESSION_WORD_COUNT = 10

type VocabularyCollection = Record<string, readonly unknown[] | undefined>

export function getSessionQuestionCount(questionIds: readonly string[]): number {
  return Math.min(SESSION_QUESTION_COUNT, questionIds.length)
}

export function createSessionVocabularyLimits(
  order: readonly string[],
  vocabularyByQuestionId: VocabularyCollection,
): Record<string, number> {
  const sessionIds = order.slice(0, SESSION_QUESTION_COUNT)
  const result: Record<string, number> = {}
  let remaining = SESSION_WORD_COUNT

  sessionIds.forEach((id, index) => {
    const available = vocabularyByQuestionId[id]?.length ?? 0
    const futureAvailable = sessionIds
      .slice(index + 1)
      .reduce((sum, nextId) => sum + (vocabularyByQuestionId[nextId]?.length ?? 0), 0)
    const requiredNow = Math.max(0, remaining - futureAvailable)
    const evenShare = Math.ceil(remaining / (sessionIds.length - index))
    const limit = Math.min(available, Math.max(requiredNow, evenShare))

    result[id] = limit
    remaining = Math.max(0, remaining - limit)
  })

  return result
}
