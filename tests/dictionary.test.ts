import { describe, expect, it, vi } from 'vitest'
import {
  DICTIONARY_CACHE_KEY,
  getDictionaryLookupTerm,
  loadDictionaryEntry,
  parseDictionaryResponse,
} from '../src/lib/dictionary'

const apiPayload = [
  {
    word: 'reinforce',
    phonetic: '/ˌriːɪnˈfɔːrs/',
    phonetics: [
      {
        text: '/ˌriːɪnˈfɔːrs/',
        audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/reinforce-us.mp3',
      },
    ],
    meanings: [
      {
        partOfSpeech: 'verb',
        definitions: [
          {
            definition: 'To strengthen, especially by addition or augmentation.',
            example: 'The evidence reinforced the argument.',
          },
        ],
      },
    ],
    license: {
      name: 'CC BY-SA 3.0',
      url: 'https://creativecommons.org/licenses/by-sa/3.0',
    },
    sourceUrls: ['https://en.wiktionary.org/wiki/reinforce'],
  },
]

describe('online dictionary', () => {
  it('chooses a useful lookup word from a local phrase', () => {
    expect(getDictionaryLookupTerm('be attributed to')).toBe('attributed')
    expect(getDictionaryLookupTerm('the nature of the task')).toBe('nature')
    expect(getDictionaryLookupTerm('correlation')).toBe('correlation')
  })

  it('parses a small, safe view of the remote response', () => {
    expect(parseDictionaryResponse(apiPayload)).toEqual({
      word: 'reinforce',
      phonetic: '/ˌriːɪnˈfɔːrs/',
      audioUrl: 'https://api.dictionaryapi.dev/media/pronunciations/en/reinforce-us.mp3',
      senses: [
        {
          partOfSpeech: 'verb',
          definition: 'To strengthen, especially by addition or augmentation.',
          example: 'The evidence reinforced the argument.',
        },
      ],
      sourceUrl: 'https://en.wiktionary.org/wiki/reinforce',
      license: {
        name: 'CC BY-SA 3.0',
        url: 'https://creativecommons.org/licenses/by-sa/3.0',
      },
    })
  })

  it('fetches once and then reads the validated result from cache', async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => apiPayload,
    })

    const online = await loadDictionaryEntry('reinforce', { fetcher, storage, now: 1_000 })
    const cached = await loadDictionaryEntry('reinforce', { fetcher, storage, now: 2_000 })

    expect(online?.source).toBe('online')
    expect(cached?.source).toBe('cache')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(values.has(DICTIONARY_CACHE_KEY)).toBe(true)
  })

  it('returns null for a word the API does not know', async () => {
    const result = await loadDictionaryEntry('not-a-real-word', {
      fetcher: vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
      storage: null,
    })

    expect(result).toBeNull()
  })
})
