import { describe, expect, it, vi } from 'vitest'
import {
  QUESTION_BANK_CACHE_KEY,
  SENTENCE_BANK_CACHE_KEY,
  createLocalSentenceBank,
  loadQuestionBank,
  loadSentenceBank,
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
      qualityScore: 88,
      exams: ['cet4', 'ky'],
      source: {
        name: 'Tatoeba / ManyThings',
        url: 'https://www.manythings.org/anki/',
        license: 'CC BY 2.0 FR',
        licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/',
        attribution: 'tatoeba.org #1 (A) & #2 (B)',
        adaptation: 'Converted to Simplified Chinese with generated distractors.',
      },
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
    expect(bank?.questionById.get('online-1')?.exams).toEqual(['cet4', 'ky'])
    expect(bank?.questionById.get('online-1')?.source?.license).toBe('CC BY 2.0 FR')
    expect(bank?.questionById.get('online-1')?.qualityScore).toBe(88)
    expect(bank?.vocabularyByQuestionId['online-1'][0].term).toBe('at face value')
  })

  it('rejects malformed remote questions', () => {
    const malformed = structuredClone(validPayload)
    malformed.questions[0].options.pop()

    expect(parseQuestionBankPayload(malformed)).toBeNull()
  })

  it('rejects unsafe source links from remote question data', () => {
    const malformed = structuredClone(validPayload)
    malformed.questions[0].source.url = 'javascript:alert(1)'

    expect(parseQuestionBankPayload(malformed)).toBeNull()
  })

  it('rejects insecure source links from remote question data', () => {
    const malformed = structuredClone(validPayload)
    malformed.questions[0].source.url = 'http://example.com/source'

    expect(parseQuestionBankPayload(malformed)).toBeNull()
  })

  it('rejects an out-of-range question quality score', () => {
    const malformed = structuredClone(validPayload)
    malformed.questions[0].qualityScore = 101

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
    expect(result.questionIds).toHaveLength(80)
  })

  it('ships a multi-exam sentence fallback with source attribution', () => {
    const bank = createLocalSentenceBank()

    expect(bank.questions.length).toBeGreaterThanOrEqual(70)
    expect(new Set(bank.questions.flatMap((question) => question.exams ?? []))).toEqual(
      new Set(['cet4', 'cet6', 'ky', 'ielts', 'toefl']),
    )
    expect(bank.questions.every((question) => question.source?.license === 'CC BY 2.0 FR')).toBe(true)
    for (const exam of ['cet4', 'cet6', 'ky', 'ielts', 'toefl'] as const) {
      for (const level of ['基础', '进阶', '挑战'] as const) {
        expect(bank.questions.filter((question) => (
          question.exams?.includes(exam) && question.level === level
        )).length).toBeGreaterThanOrEqual(5)
      }
    }
  })

  it('loads and caches the independent online sentence bank', async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    }
    const result = await loadSentenceBank({
      url: 'https://example.com/sentence-bank.json',
      fetcher: vi.fn().mockResolvedValue({ ok: true, json: async () => validPayload }),
      storage,
    })

    expect(result.source).toBe('online')
    expect(result.questionIds).toEqual(['online-1'])
    expect(storage.setItem).toHaveBeenCalledWith(SENTENCE_BANK_CACHE_KEY, JSON.stringify(validPayload))
  })

  it('requires attribution metadata for an independent sentence bank', async () => {
    const malformed = structuredClone(validPayload)
    // @ts-expect-error The malformed payload intentionally removes required source data.
    delete malformed.questions[0].source

    const result = await loadSentenceBank({
      fetcher: vi.fn().mockResolvedValue({ ok: true, json: async () => malformed }),
      storage: null,
    })

    expect(result.source).toBe('local')
  })

  it('falls back to cached questions when a request times out', async () => {
    const storage = createStorage()
    storage.setItem(QUESTION_BANK_CACHE_KEY, JSON.stringify(validPayload))

    const result = await loadQuestionBank({
      fetcher: vi.fn(() => new Promise<never>(() => undefined)),
      storage,
      timeoutMs: 5,
    })

    expect(result.source).toBe('cache')
    expect(result.questionIds).toEqual(['online-1'])
  })

  it('rejects a response that declares an excessive byte length', async () => {
    const result = await loadQuestionBank({
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '2000000' },
        json: async () => validPayload,
      }),
      storage: null,
    })

    expect(result.source).toBe('local')
  })
})
