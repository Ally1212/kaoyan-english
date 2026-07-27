export const DICTIONARY_CACHE_KEY = 'kaoyan-english-dictionary-v1'

const DEFAULT_DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 100

export interface DictionarySense {
  partOfSpeech: string
  definition: string
  example?: string
}

export interface DictionaryEntry {
  word: string
  phonetic?: string
  audioUrl?: string
  senses: DictionarySense[]
  sourceUrl?: string
  license?: {
    name: string
    url: string
  }
}

export interface LoadedDictionaryEntry extends DictionaryEntry {
  source: 'online' | 'cache'
}

interface FetchResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type DictionaryFetcher = (input: string, init?: RequestInit) => Promise<FetchResponse>

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface CacheItem {
  savedAt: number
  entry: DictionaryEntry
}

interface DictionaryCache {
  version: 1
  entries: Record<string, CacheItem>
}

interface LoadDictionaryOptions {
  apiUrl?: string
  fetcher?: DictionaryFetcher
  storage?: StorageLike | null
  now?: number
}

const phraseStopWords = new Set([
  'a', 'an', 'and', 'as', 'at', 'b', 'be', 'been', 'being', 'by', 'do', 'for',
  'from', 'in', 'into', 'is', 'it', 'not', 'of', 'on', 'or', 'that', 'the',
  'than', 'to', 'with',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null

  const result = value.trim()
  return result.length > 0 && result.length <= maxLength ? result : null
}

function readHttpsUrl(value: unknown): string | undefined {
  const text = readString(value, 1000)
  if (!text) return undefined

  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function parseEntry(value: unknown): DictionaryEntry | null {
  if (!isRecord(value)) return null

  const word = readString(value.word, 100)
  if (!word || !Array.isArray(value.meanings)) return null

  const phonetics = Array.isArray(value.phonetics) ? value.phonetics : []
  const phonetic = readString(value.phonetic, 100)
    ?? phonetics.map((item) => isRecord(item) ? readString(item.text, 100) : null).find(Boolean)
    ?? undefined
  const audioUrl = phonetics
    .map((item) => isRecord(item) ? readHttpsUrl(item.audio) : undefined)
    .find(Boolean)
  const senses: DictionarySense[] = []

  for (const meaning of value.meanings) {
    if (!isRecord(meaning) || !Array.isArray(meaning.definitions)) continue

    const partOfSpeech = readString(meaning.partOfSpeech, 60) ?? 'definition'
    for (const candidate of meaning.definitions) {
      if (!isRecord(candidate)) continue

      const definition = readString(candidate.definition, 1000)
      if (!definition) continue

      const example = readString(candidate.example, 1000) ?? undefined
      senses.push({ partOfSpeech, definition, ...(example ? { example } : {}) })
      if (senses.length === 3) break
    }

    if (senses.length === 3) break
  }

  if (senses.length === 0) return null

  const sourceUrl = Array.isArray(value.sourceUrls)
    ? value.sourceUrls.map(readHttpsUrl).find(Boolean)
    : undefined
  const licenseValue = value.license
  const licenseName = isRecord(licenseValue) ? readString(licenseValue.name, 100) : null
  const licenseUrl = isRecord(licenseValue) ? readHttpsUrl(licenseValue.url) : undefined
  const license = licenseName && licenseUrl ? { name: licenseName, url: licenseUrl } : undefined

  return {
    word,
    ...(phonetic ? { phonetic } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    senses,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(license ? { license } : {}),
  }
}

function parseCachedEntry(value: unknown): DictionaryEntry | null {
  if (!isRecord(value)) return null

  const word = readString(value.word, 100)
  if (!word || !Array.isArray(value.senses)) return null

  const senses: DictionarySense[] = []
  for (const candidate of value.senses) {
    if (!isRecord(candidate)) continue

    const partOfSpeech = readString(candidate.partOfSpeech, 60)
    const definition = readString(candidate.definition, 1000)
    const example = readString(candidate.example, 1000) ?? undefined
    if (!partOfSpeech || !definition) continue

    senses.push({ partOfSpeech, definition, ...(example ? { example } : {}) })
    if (senses.length === 3) break
  }

  if (senses.length === 0) return null

  const phonetic = readString(value.phonetic, 100) ?? undefined
  const audioUrl = readHttpsUrl(value.audioUrl)
  const sourceUrl = readHttpsUrl(value.sourceUrl)
  const licenseValue = value.license
  const licenseName = isRecord(licenseValue) ? readString(licenseValue.name, 100) : null
  const licenseUrl = isRecord(licenseValue) ? readHttpsUrl(licenseValue.url) : undefined
  const license = licenseName && licenseUrl ? { name: licenseName, url: licenseUrl } : undefined

  return {
    word,
    ...(phonetic ? { phonetic } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    senses,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(license ? { license } : {}),
  }
}

export function parseDictionaryResponse(value: unknown): DictionaryEntry | null {
  if (!Array.isArray(value)) return null

  for (const candidate of value) {
    const entry = parseEntry(candidate)
    if (entry) return entry
  }

  return null
}

export function getDictionaryLookupTerm(term: string): string | null {
  const tokens = term.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g)
  if (!tokens?.length) return null
  if (tokens.length === 1) return tokens[0].toLocaleLowerCase('en')

  const candidates = tokens.filter((token) => !phraseStopWords.has(token.toLocaleLowerCase('en')))
  const pool = candidates.length > 0 ? candidates : tokens
  const longest = pool.reduce((current, token) => token.length > current.length ? token : current)
  return longest.toLocaleLowerCase('en')
}

function defaultStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

function readCache(storage: StorageLike | null): DictionaryCache {
  try {
    const raw = storage?.getItem(DICTIONARY_CACHE_KEY)
    if (!raw) return { version: 1, entries: {} }

    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.entries)) {
      return { version: 1, entries: {} }
    }

    const entries: Record<string, CacheItem> = {}
    for (const [key, candidate] of Object.entries(value.entries)) {
      if (!isRecord(candidate) || typeof candidate.savedAt !== 'number') continue

      const entry = parseCachedEntry(candidate.entry)
      if (entry) entries[key] = { savedAt: candidate.savedAt, entry }
    }

    return { version: 1, entries }
  } catch {
    return { version: 1, entries: {} }
  }
}

function writeCache(storage: StorageLike | null, cache: DictionaryCache): void {
  if (!storage) return

  try {
    const entries = Object.entries(cache.entries)
      .sort(([, left], [, right]) => right.savedAt - left.savedAt)
      .slice(0, MAX_CACHE_ENTRIES)
    storage.setItem(DICTIONARY_CACHE_KEY, JSON.stringify({
      version: 1,
      entries: Object.fromEntries(entries),
    }))
  } catch {
    // Dictionary results remain usable when browser storage is unavailable.
  }
}

function defaultApiUrl(): string {
  return import.meta.env.VITE_DICTIONARY_API_URL?.trim() || DEFAULT_DICTIONARY_API_URL
}

export async function loadDictionaryEntry(
  query: string,
  options: LoadDictionaryOptions = {},
): Promise<LoadedDictionaryEntry | null> {
  const normalizedQuery = getDictionaryLookupTerm(query)
  if (!normalizedQuery) return null

  const now = options.now ?? Date.now()
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const cache = readCache(storage)
  const cached = cache.entries[normalizedQuery]

  if (cached && now - cached.savedAt <= CACHE_TTL_MS) {
    return { ...cached.entry, source: 'cache' }
  }

  const fetcher = options.fetcher ?? globalThis.fetch
  if (typeof fetcher !== 'function') {
    if (cached) return { ...cached.entry, source: 'cache' }
    throw new Error('Dictionary fetch is unavailable')
  }

  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000)

  try {
    const apiUrl = (options.apiUrl ?? defaultApiUrl()).replace(/\/$/, '')
    const response = await fetcher(`${apiUrl}/${encodeURIComponent(normalizedQuery)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (response.status === 404) {
      return cached ? { ...cached.entry, source: 'cache' } : null
    }
    if (!response.ok) throw new Error(`Dictionary request failed with ${response.status}`)

    const entry = parseDictionaryResponse(await response.json())
    if (!entry) throw new Error('Dictionary response is invalid')

    cache.entries[normalizedQuery] = { savedAt: now, entry }
    writeCache(storage, cache)
    return { ...entry, source: 'online' }
  } catch (error) {
    if (cached) return { ...cached.entry, source: 'cache' }
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}
