import { describe, expect, it } from 'vitest'
import {
  QUESTION_FEEDBACK_STORAGE_KEY,
  loadQuestionFeedback,
  toggleQuestionFeedback,
} from '../src/lib/questionFeedback'

describe('question quality feedback', () => {
  it('adds and removes one local question report without duplicates', () => {
    const reported = toggleQuestionFeedback([], 'tat-1', '2026-07-28T00:00:00.000Z')
    const duplicate = toggleQuestionFeedback(reported, 'tat-1', '2026-07-28T01:00:00.000Z')

    expect(reported).toEqual([{ questionId: 'tat-1', reportedAt: '2026-07-28T00:00:00.000Z' }])
    expect(duplicate).toEqual([])
  })

  it('filters malformed browser records', () => {
    window.localStorage.setItem(QUESTION_FEEDBACK_STORAGE_KEY, JSON.stringify([
      { questionId: 'tat-1', reportedAt: '2026-07-28T00:00:00.000Z' },
      { questionId: 'tat-1', reportedAt: '2026-07-28T01:00:00.000Z' },
      { questionId: '', reportedAt: 'bad-date' },
    ]))

    expect(loadQuestionFeedback()).toEqual([
      { questionId: 'tat-1', reportedAt: '2026-07-28T00:00:00.000Z' },
    ])
  })
})
