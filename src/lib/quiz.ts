import type { Question } from '../data/questions'

export interface QuizProgress {
  version: 1
  order: string[]
  cursor: number
  answered: number
  correct: number
  selectedIndex: number | null
}

export function createReadingQuestion(
  question: Question,
  pass: 'practice' | 'review',
): Question {
  if (pass === 'practice') return question

  const correctAnswer = question.options[question.answer]
  const answer = ((question.answer + 1) % 4) as 0 | 1 | 2 | 3
  const options = question.options.filter((_, index) => index !== question.answer)
  options.splice(answer, 0, correctAnswer)

  return {
    ...question,
    options: options as [string, string, string, string],
    answer,
  }
}

export function shuffleIds(ids: string[], random: () => number = Math.random): string[] {
  const result = [...ids]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }

  return result
}

export function createOrder(
  ids: string[],
  previousId?: string,
  random: () => number = Math.random,
  getWeight?: (id: string) => number,
): string[] {
  const order = getWeight
    ? ids
        .map((id, index) => {
          const weight = Math.max(Number.EPSILON, getWeight(id))
          const sample = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, random()))
          return { id, index, key: -Math.log(sample) / weight }
        })
        .sort((left, right) => left.key - right.key || left.index - right.index)
        .map(({ id }) => id)
    : shuffleIds(ids, random)

  if (order.length > 1 && previousId && order[0] === previousId) {
    ;[order[0], order[1]] = [order[1], order[0]]
  }

  return order
}

export function createProgress(
  ids: string[],
  random: () => number = Math.random,
  getWeight?: (id: string) => number,
): QuizProgress {
  return {
    version: 1,
    order: createOrder(ids, undefined, random, getWeight),
    cursor: 0,
    answered: 0,
    correct: 0,
    selectedIndex: null,
  }
}

export function normalizeProgress(
  value: unknown,
  ids: string[],
  random: () => number = Math.random,
): QuizProgress {
  if (!value || typeof value !== 'object') return createProgress(ids, random)

  const candidate = value as Partial<QuizProgress>
  const validIds = new Set(ids)
  const seen = new Set<string>()
  const savedOrder = Array.isArray(candidate.order)
    ? candidate.order.filter((id): id is string => {
        if (typeof id !== 'string' || !validIds.has(id) || seen.has(id)) return false
        seen.add(id)
        return true
      })
    : []
  const missingIds = ids.filter((id) => !seen.has(id))
  const order = [...savedOrder, ...shuffleIds(missingIds, random)]

  if (order.length === 0) return createProgress(ids, random)

  const answered = Number.isInteger(candidate.answered) && Number(candidate.answered) >= 0
    ? Number(candidate.answered)
    : 0
  const correctCandidate = Number.isInteger(candidate.correct) && Number(candidate.correct) >= 0
    ? Number(candidate.correct)
    : 0
  const cursorCandidate = Number.isInteger(candidate.cursor) ? Number(candidate.cursor) : 0
  const selectedIndex = Number.isInteger(candidate.selectedIndex)
    && Number(candidate.selectedIndex) >= 0
    && Number(candidate.selectedIndex) <= 3
    ? Number(candidate.selectedIndex)
    : null

  return {
    version: 1,
    order,
    cursor: Math.min(Math.max(cursorCandidate, 0), order.length - 1),
    answered,
    correct: Math.min(correctCandidate, answered),
    selectedIndex,
  }
}

export function advanceProgress(
  progress: QuizProgress,
  ids: string[],
  random: () => number = Math.random,
  roundLength: number = ids.length,
  getWeight?: (id: string) => number,
): QuizProgress {
  const finalCursor = Math.min(progress.order.length, Math.max(1, roundLength)) - 1

  if (progress.cursor < finalCursor) {
    return {
      ...progress,
      cursor: progress.cursor + 1,
      selectedIndex: null,
    }
  }

  const previousId = progress.order[progress.cursor]

  return {
    ...progress,
    order: createOrder(ids, previousId, random, getWeight),
    cursor: 0,
    selectedIndex: null,
  }
}
