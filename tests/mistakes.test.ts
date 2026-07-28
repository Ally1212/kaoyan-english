import { describe, expect, it } from 'vitest'
import {
  MISTAKE_STORAGE_KEY,
  MAX_MISTAKE_RECORDS,
  applyReviewResult,
  buildReviewQueue,
  loadMistakes,
  recordMistake,
  type MistakeRecord,
} from '../src/lib/mistakes'

const attempt = {
  key: 'word-zh:ky:abandon',
  itemId: 'abandon',
  exam: 'ky' as const,
  mode: 'word-zh' as const,
  prompt: 'abandon',
  selectedAnswer: '获得',
  correctAnswer: '放弃',
  explanation: 'abandon 表示放弃。',
}

describe('mistake records', () => {
  it('adds a mistake and increments repeat errors without duplicating it', () => {
    const first = recordMistake([], attempt, '2026-07-28T00:00:00.000Z')
    const second = recordMistake(first, attempt, '2026-07-28T01:00:00.000Z')

    expect(second).toHaveLength(1)
    expect(second[0].wrongCount).toBe(2)
    expect(second[0].status).toBe('待复习')
    expect(second[0].reviewStage).toBe(0)
    expect(second[0].nextReviewAt).toBe('2026-07-28T01:00:00.000Z')
  })

  it('schedules correct reviews after one, three, and seven days', () => {
    const records = recordMistake([], attempt, '2026-07-28T00:00:00.000Z')
    const first = applyReviewResult(records, attempt.key, true, '2026-07-28T01:00:00.000Z')
    const second = applyReviewResult(first, attempt.key, true, '2026-07-29T01:00:00.000Z')
    const mastered = applyReviewResult(second, attempt.key, true, '2026-08-01T01:00:00.000Z')

    expect(first[0]).toMatchObject({
      reviewStage: 1,
      nextReviewAt: '2026-07-29T01:00:00.000Z',
      status: '巩固中',
    })
    expect(second[0]).toMatchObject({
      reviewStage: 2,
      nextReviewAt: '2026-08-01T01:00:00.000Z',
      status: '巩固中',
    })
    expect(mastered[0].reviewStage).toBe(3)
    expect(mastered[0].nextReviewAt).toBe('2026-08-08T01:00:00.000Z')
    expect(mastered[0].status).toBe('已掌握')
  })

  it('returns a mastered item to pending after another wrong review', () => {
    const mastered: MistakeRecord[] = [{
      ...recordMistake([], attempt, '2026-07-28T00:00:00.000Z')[0],
      reviewStage: 3,
      status: '已掌握',
    }]

    expect(applyReviewResult(mastered, attempt.key, false, '2026-08-10T00:00:00.000Z')[0]).toMatchObject({
      reviewStage: 0,
      nextReviewAt: '2026-08-10T00:00:00.000Z',
      status: '待复习',
    })
  })

  it('adds unresolved historical mistakes after current-round mistakes without duplicates', () => {
    const current = [{ ...attempt, reviewOrigin: '本轮' as const }]
    const historicalAttempt = { ...attempt, key: 'word-zh:ky:ability', itemId: 'ability', prompt: 'ability' }
    const records = [
      ...recordMistake([], attempt, '2026-07-28T00:00:00.000Z'),
      ...recordMistake([], historicalAttempt, '2026-07-28T01:00:00.000Z'),
    ]

    const queue = buildReviewQueue(
      current,
      records,
      'ky',
      'word-zh',
      ['abandon', 'ability'],
      5,
      '2026-07-28T02:00:00.000Z',
    )

    expect(queue.map((item) => item.itemId)).toEqual(['abandon', 'ability'])
    expect(queue.map((item) => item.reviewOrigin)).toEqual(['本轮', '历史'])
  })

  it('waits until a historical mistake is due before adding it to review', () => {
    const scheduled = applyReviewResult(
      recordMistake([], attempt, '2026-07-28T00:00:00.000Z'),
      attempt.key,
      true,
      '2026-07-28T01:00:00.000Z',
    )

    expect(buildReviewQueue([], scheduled, 'ky', 'word-zh', ['abandon'], 5, '2026-07-28T12:00:00.000Z')).toEqual([])
    expect(buildReviewQueue([], scheduled, 'ky', 'word-zh', ['abandon'], 5, '2026-07-29T01:00:00.000Z')).toHaveLength(1)
  })

  it('ignores malformed records from browser storage', () => {
    const valid = recordMistake([], attempt, '2026-07-28T00:00:00.000Z')[0]
    window.localStorage.setItem(MISTAKE_STORAGE_KEY, JSON.stringify([
      { key: 'old-schema-record' },
      valid,
      { ...valid, wrongCount: -1 },
    ]))

    expect(loadMistakes()).toEqual([valid])
  })

  it('deduplicates valid stored records and review queue entries by key', () => {
    const older = recordMistake([], attempt, '2026-07-28T00:00:00.000Z')[0]
    const newer = recordMistake([], attempt, '2026-07-29T00:00:00.000Z')[0]
    window.localStorage.setItem(MISTAKE_STORAGE_KEY, JSON.stringify([newer, older]))

    const loaded = loadMistakes()
    expect(loaded).toEqual([newer])
    expect(buildReviewQueue(
      [],
      [newer, older],
      'ky',
      'word-zh',
      ['abandon'],
      5,
      '2026-07-30T00:00:00.000Z',
    )).toHaveLength(1)
  })

  it('caps long-term mistake history to protect browser storage', () => {
    const records = Array.from({ length: MAX_MISTAKE_RECORDS + 20 }, (_, index) => (
      recordMistake([], {
        ...attempt,
        key: `word-zh:ky:word-${index}`,
        itemId: `word-${index}`,
      }, '2026-07-28T00:00:00.000Z')[0]
    ))

    const next = recordMistake(records, {
      ...attempt,
      key: 'word-zh:ky:newest',
      itemId: 'newest',
    })

    expect(next).toHaveLength(MAX_MISTAKE_RECORDS)
    expect(next[0].itemId).toBe('newest')
  })
})
