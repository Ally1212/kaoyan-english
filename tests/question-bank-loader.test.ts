import { describe, expect, it, vi } from 'vitest'
import {
  QUESTION_BANK_CACHE_KEY,
  loadQuestionBank,
  parseQuestionBankPayload,
} from '../src/lib/questionBank'

const validPayload = {
  version: 1,
  questions: [
    {
      id: 'online-1',
      kind: '句子',
      level: '基础',
      tag: '否定',
      english: 'A careful reader does not accept every claim at face value.',
      options: ['读者接受所有说法。', '谨慎的读者不会轻信每个说法。', '读者拒绝所有信息。', '所有说法都没有价值。'],
      answer: 1,
      explanation: 'does not accept every claim 表示不会不加判断地接受每一个说法。',
      vocabulary: [
        { term: 'at face value', meaning: '不加怀疑地', breakdown: '表示只按照表面意思接受，不进一步核查。' },
      ],
    },
  ],
}

function createStorage(initial?: unknown) {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(QUESTION_BANK_CACHE_KEY, JSON.stringify(initial))

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  }
}

describe('online question bank', () => {
  it('parses a complete payload into question and vocabulary indexes', () => {
    const bank = parseQuestionBankPayload(validPayload)

    expect(bank?.questionIds).toEqual(['online-1'])
    expect(bank?.questionById.get('online-1')?.answer).toBe(1)
    expect(bank?.vocabularyByQuestionId['online-1'][0].term).toBe('at face value')
  })

  it('rejects malformed remote questions', () => {
    const malformed = structuredClone(validPayload)
    malformed.questions[0].options.pop()

    expect(parseQuestionBankPayload(malformed)).toBeNull()
  })

  it('uses valid online data and caches it', async () => {
    const storage = createStorage()
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validPayload,
    })

    const result = await loadQuestionBank({
      url: 'https://example.com/question-bank.json',
      fetcher,
      storage,
    })

    expect(result.source).toBe('online')
    expect(result.questionIds).toEqual(['online-1'])
    expect(storage.setItem).toHaveBeenCalledWith(QUESTION_BANK_CACHE_KEY, JSON.stringify(validPayload))
  })

  it('falls back to cached data when the network fails', async () => {
    const result = await loadQuestionBank({
      url: 'https://example.com/question-bank.json',
      fetcher: vi.fn().mockRejectedValue(new Error('offline')),
      storage: createStorage(validPayload),
    })

    expect(result.source).toBe('cache')
    expect(result.questionIds).toEqual(['online-1'])
  })

  it('ignores invalid online data and keeps the last valid cache', async () => {
    const result = await loadQuestionBank({
      url: 'https://example.com/question-bank.json',
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 1, questions: [] }),
      }),
      storage: createStorage(validPayload),
    })

    expect(result.source).toBe('cache')
    expect(result.questionIds).toEqual(['online-1'])
  })

  it('falls back to the bundled bank when network and cache are unavailable', async () => {
    const result = await loadQuestionBank({
      url: 'https://example.com/question-bank.json',
      fetcher: vi.fn().mockRejectedValue(new Error('offline')),
      storage: createStorage(),
    })

    expect(result.source).toBe('local')
    expect(result.questionIds).toHaveLength(40)
  })
})
