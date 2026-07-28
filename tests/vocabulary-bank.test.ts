import { describe, expect, it, vi } from 'vitest'
import {
  VOCABULARY_BANK_CACHE_KEY,
  getWordsForExam,
  loadVocabularyBank,
  mergeVocabularyBanks,
  parseVocabularyBankPayload,
} from '../src/lib/vocabularyBank'

const payload = {
  version: 1,
  source: {
    name: 'ECDICT',
    url: 'https://github.com/skywind3000/ECDICT',
    license: 'MIT',
    snapshot: 'test',
  },
  words: [
    {
      word: 'abandon',
      phonetic: "ə'bændən",
      translation: '放弃；抛弃',
      definition: 'to leave something completely',
      pos: 'v',
      tags: ['cet4', 'cet6', 'ky', 'toefl'],
      frequency: 1200,
    },
    {
      word: 'academic',
      phonetic: 'ækədemɪk',
      translation: '学术的',
      definition: 'related to education and study',
      pos: 'adj',
      tags: ['ielts', 'toefl'],
      frequency: 1800,
    },
  ],
}

describe('vocabulary bank', () => {
  it('parses one shared bank and filters words by exam tag', () => {
    const bank = parseVocabularyBankPayload(payload)

    expect(bank).not.toBeNull()
    expect(getWordsForExam(bank!.words, 'cet4').map((word) => word.word)).toEqual(['abandon'])
    expect(getWordsForExam(bank!.words, 'toefl')).toHaveLength(2)
  })

  it('loads online data and caches the validated payload', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }

    const result = await loadVocabularyBank({
      url: '/vocabulary-bank.json',
      fetcher: vi.fn(async () => ({ ok: true, json: async () => payload })),
      storage,
    })

    expect(result.source).toBe('online')
    expect(result.words).toHaveLength(2)
    expect(storage.setItem).toHaveBeenCalledWith(VOCABULARY_BANK_CACHE_KEY, JSON.stringify(payload))
  })

  it('falls back to bundled core words when online and cache are unavailable', async () => {
    const result = await loadVocabularyBank({
      fetcher: vi.fn(async () => { throw new Error('offline') }),
      storage: { getItem: () => null, setItem: () => undefined },
    })

    expect(result.source).toBe('local')
    expect(result.words.length).toBeGreaterThanOrEqual(25)
    expect(getWordsForExam(result.words, 'cet4').length).toBeGreaterThan(0)
    expect(getWordsForExam(result.words, 'toefl').length).toBeGreaterThan(0)
  })

  it('keeps online words while filling missing examinations from the local fallback', () => {
    const online = parseVocabularyBankPayload(payload)!
    const local = parseVocabularyBankPayload({
      version: 1,
      words: [{
        word: 'research',
        phonetic: 'rɪsɜːtʃ',
        translation: '研究',
        definition: 'careful study to discover facts',
        pos: 'n',
        tags: ['ky'],
        frequency: 10,
      }],
    })!

    const merged = mergeVocabularyBanks(online, local)

    expect(merged.words.map((word) => word.id)).toEqual(['abandon', 'academic', 'research'])
    expect(getWordsForExam(merged.words, 'ky').map((word) => word.id)).toEqual(['abandon', 'research'])
  })
})
