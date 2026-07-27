import { describe, expect, it } from 'vitest'
import { questionIds } from '../src/data/questions'
import { vocabularyByQuestionId } from '../src/data/vocabulary'
import {
  SESSION_QUESTION_COUNT,
  SESSION_WORD_COUNT,
  createSessionVocabularyLimits,
} from '../src/lib/trainingSession'

describe('ten-word training session', () => {
  it('allocates exactly ten bundled vocabulary items across five questions', () => {
    const order = questionIds.slice(0, SESSION_QUESTION_COUNT)
    const limits = createSessionVocabularyLimits(order, vocabularyByQuestionId)
    const total = order.reduce((sum, id) => sum + (limits[id] ?? 0), 0)

    expect(total).toBe(SESSION_WORD_COUNT)
    expect(order.every((id) => limits[id] === 2)).toBe(true)
  })

  it('never allocates more words than a question contains', () => {
    const limits = createSessionVocabularyLimits(
      ['q1', 'q2'],
      {
        q1: [{ term: 'one' }, { term: 'two' }],
        q2: [{ term: 'three' }],
      },
    )

    expect(limits).toEqual({ q1: 2, q2: 1 })
  })
})
