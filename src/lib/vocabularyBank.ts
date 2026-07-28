import { bundledVocabularyWords } from '../data/vocabularyFallback'
import { fetchJsonWithTimeout, type JsonFetcher } from './network'

export const VOCABULARY_BANK_CACHE_KEY = 'kaoyan-english-vocabulary-bank-v1'
export const examLibraries = ['cet4', 'cet6', 'ky', 'ielts', 'toefl'] as const

export type ExamLibrary = typeof examLibraries[number]
export type VocabularyBankSource = 'online' | 'cache' | 'local'

export interface VocabularyWord {
  id: string
  word: string
  phonetic: string
  translation: string
  definition: string
  pos: string
  tags: ExamLibrary[]
  frequency: number
}

export interface VocabularyBank {
  words: VocabularyWord[]
  wordById: Map<string, VocabularyWord>
}

export interface LoadedVocabularyBank extends VocabularyBank {
  source: VocabularyBankSource
}

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface LoadVocabularyBankOptions {
  url?: string
  fetcher?: JsonFetcher
  storage?: StorageLike | null
  timeoutMs?: number
}

const DEFAULT_FETCH_TIMEOUT_MS = 5_000
const MAX_LOCAL_CACHE_LENGTH = 1_000_000
const MAX_VOCABULARY_BANK_BYTES = 4_000_000

const validExamLibraries = new Set<ExamLibrary>(examLibraries)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, maxLength: number, allowEmpty = false): string | null {
  if (typeof value !== 'string') return null
  const result = value.trim()
  return (allowEmpty || result.length > 0) && result.length <= maxLength ? result : null
}

function createBank(words: VocabularyWord[]): VocabularyBank {
  return {
    words,
    wordById: new Map(words.map((word) => [word.id, word])),
  }
}

export function parseVocabularyBankPayload(value: unknown): VocabularyBank | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.words)) return null
  if (value.words.length === 0 || value.words.length > 20_000) return null

  const words: VocabularyWord[] = []
  const ids = new Set<string>()

  for (const candidate of value.words) {
    if (!isRecord(candidate)) return null

    const word = readString(candidate.word, 100)
    const phonetic = readString(candidate.phonetic, 100, true)
    const translation = readString(candidate.translation, 180)
    const definition = readString(candidate.definition, 240)
    const pos = readString(candidate.pos, 80, true)
    const frequency = candidate.frequency
    const id = word?.toLocaleLowerCase('en')

    if (
      !word
      || phonetic === null
      || !translation
      || !definition
      || pos === null
      || !id
      || ids.has(id)
      || !Array.isArray(candidate.tags)
      || candidate.tags.length === 0
      || candidate.tags.some((tag) => typeof tag !== 'string' || !validExamLibraries.has(tag as ExamLibrary))
      || !Number.isInteger(frequency)
      || Number(frequency) < 0
    ) return null

    ids.add(id)
    words.push({
      id,
      word,
      phonetic,
      translation,
      definition,
      pos,
      tags: [...new Set(candidate.tags as ExamLibrary[])],
      frequency: Number(frequency),
    })
  }

  return createBank(words)
}

export function getWordsForExam(
  words: readonly VocabularyWord[],
  exam: ExamLibrary,
): VocabularyWord[] {
  return words.filter((word) => word.tags.includes(exam))
}

export function mergeVocabularyBanks(...banks: readonly VocabularyBank[]): VocabularyBank {
  const wordById = new Map<string, VocabularyWord>()

  banks.forEach((bank) => {
    bank.words.forEach((word) => {
      if (!wordById.has(word.id)) wordById.set(word.id, word)
    })
  })

  return createBank([...wordById.values()])
}

function defaultVocabularyBankUrl(): string {
  const configuredUrl = import.meta.env.VITE_VOCABULARY_BANK_URL?.trim()
  return configuredUrl || `${import.meta.env.BASE_URL || './'}vocabulary-bank.json`
}

function defaultStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function createLocalVocabularyBank(): VocabularyBank {
  return createBank(bundledVocabularyWords.map((word) => ({
    ...word,
    id: word.word.toLocaleLowerCase('en'),
    tags: [...word.tags],
  })))
}

export async function loadVocabularyBank(
  options: LoadVocabularyBankOptions = {},
): Promise<LoadedVocabularyBank> {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const fetcher = options.fetcher ?? globalThis.fetch
  const url = options.url ?? defaultVocabularyBankUrl()

  if (typeof fetcher === 'function') {
    try {
      const response = await fetchJsonWithTimeout(fetcher, url, {
        cache: 'default',
        headers: { Accept: 'application/json' },
      }, options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS, MAX_VOCABULARY_BANK_BYTES)

      if (response.ok) {
        const payload = response.payload
        const bank = parseVocabularyBankPayload(payload)
        if (bank) {
          try {
            const serialized = JSON.stringify(payload)
            if (serialized.length <= MAX_LOCAL_CACHE_LENGTH) {
              storage?.setItem(VOCABULARY_BANK_CACHE_KEY, serialized)
            }
          } catch {
            // The online bank remains usable when storage is full or blocked.
          }
          return { ...bank, source: 'online' }
        }
      }
    } catch {
      // Cached or bundled words are used below.
    }
  }

  try {
    const cached = storage?.getItem(VOCABULARY_BANK_CACHE_KEY)
    const bank = cached ? parseVocabularyBankPayload(JSON.parse(cached)) : null
    if (bank) return { ...bank, source: 'cache' }
  } catch {
    // Invalid or unavailable cache falls through to bundled core words.
  }

  return { ...createLocalVocabularyBank(), source: 'local' }
}
