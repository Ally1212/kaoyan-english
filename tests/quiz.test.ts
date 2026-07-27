import { describe, expect, it } from 'vitest'
import { advanceProgress, createOrder, createProgress, normalizeProgress, shuffleIds } from '../src/lib/quiz'

const ids = ['q1', 'q2', 'q3', 'q4']

describe('quiz order', () => {
  it('keeps every id exactly once when shuffled', () => {
    const result = shuffleIds(ids, () => 0.25)

    expect(result).toHaveLength(ids.length)
    expect(new Set(result)).toEqual(new Set(ids))
  })

  it('avoids repeating the previous question at the start of a new round', () => {
    const result = createOrder(ids, 'q1', () => 0)

    expect(result[0]).not.toBe('q1')
  })

  it('starts a new shuffled round after the final question', () => {
    const progress = {
      ...createProgress(ids, () => 0),
      cursor: ids.length - 1,
      selectedIndex: 2,
    }
    const previousId = progress.order[progress.cursor]
    const next = advanceProgress(progress, ids, () => 0)

    expect(next.cursor).toBe(0)
    expect(next.selectedIndex).toBeNull()
    expect(next.order[0]).not.toBe(previousId)
  })

  it('starts a new round after a five-question vocabulary session', () => {
    const longIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']
    const progress = {
      ...createProgress(longIds, () => 0),
      cursor: 4,
      selectedIndex: 1,
    }
    const previousId = progress.order[progress.cursor]
    const next = advanceProgress(progress, longIds, () => 0, 5)

    expect(next.cursor).toBe(0)
    expect(next.selectedIndex).toBeNull()
    expect(next.order[0]).not.toBe(previousId)
  })
})

describe('saved progress', () => {
  it('repairs invalid values and appends newly added questions', () => {
    const result = normalizeProgress(
      {
        order: ['q2', 'missing', 'q2'],
        cursor: 99,
        answered: 3,
        correct: 8,
        selectedIndex: 9,
      },
      ids,
      () => 0,
    )

    expect(new Set(result.order)).toEqual(new Set(ids))
    expect(result.cursor).toBe(ids.length - 1)
    expect(result.correct).toBe(3)
    expect(result.selectedIndex).toBeNull()
  })
})
