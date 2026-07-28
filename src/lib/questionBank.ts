import {
  questionById as localQuestionById,
  questionIds as localQuestionIds,
  questions as localQuestions,
  type Question,
  type QuestionExam,
  type QuestionKind,
  type QuestionLevel,
} from '../data/questions'
import { bundledSentenceQuestions } from '../data/sentenceFallback'
import {
  vocabularyByQuestionId as localVocabularyByQuestionId,
  type VocabularyItem,
} from '../data/vocabulary'
import { fetchJsonWithTimeout, type JsonFetcher } from './network'
import { examLibraries, type ExamLibrary } from './vocabularyBank'

export const QUESTION_BANK_CACHE_KEY = 'kaoyan-english-question-bank-v1'
export const SENTENCE_BANK_CACHE_KEY = 'kaoyan-english-sentence-bank-v1'

export type QuestionBankSource = 'online' | 'cache' | 'local'

export interface QuestionBank {
  questions: Question[]
  questionIds: string[]
  questionById: Map<string, Question>
  vocabularyByQuestionId: Record<string, VocabularyItem[]>
}

export interface LoadedQuestionBank extends QuestionBank {
  source: QuestionBankSource
}

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface LoadQuestionBankOptions {
  url?: string
  fetcher?: JsonFetcher
  storage?: StorageLike | null
  timeoutMs?: number
}

const DEFAULT_FETCH_TIMEOUT_MS = 5_000
const MAX_LOCAL_CACHE_LENGTH = 1_000_000
const MAX_QUESTION_BANK_BYTES = 1_000_000
const MAX_SENTENCE_BANK_BYTES = 3_000_000

const questionKinds = new Set<QuestionKind>(['句子', '短段落'])
const questionLevels = new Set<QuestionLevel>(['基础', '进阶', '挑战'])
const validExamLibraries = new Set<ExamLibrary>(examLibraries)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null

  const result = value.trim()
  return result.length > 0 && result.length <= maxLength ? result : null
}

function readHttpsUrl(value: unknown, maxLength: number): string | null {
  const result = readString(value, maxLength)
  if (!result) return null

  try {
    const url = new URL(result)
    return url.protocol === 'https:' ? result : null
  } catch {
    return null
  }
}

function parseVocabulary(value: unknown): VocabularyItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null

  const result: VocabularyItem[] = []
  const terms = new Set<string>()

  for (const candidate of value) {
    if (!isRecord(candidate)) return null

    const term = readString(candidate.term, 100)
    const meaning = readString(candidate.meaning, 200)
    const breakdown = readString(candidate.breakdown, 1000)
    const normalizedTerm = term?.toLocaleLowerCase('en')

    if (!term || !meaning || !breakdown || !normalizedTerm || terms.has(normalizedTerm)) return null

    terms.add(normalizedTerm)
    result.push({ term, meaning, breakdown })
  }

  return result
}

export function parseQuestionBankPayload(
  value: unknown,
  parserOptions: { requireSource?: boolean } = {},
): QuestionBank | null {
  if (!isRecord(value) || value.version !== 1) return null
  if (!Array.isArray(value.questions) || value.questions.length === 0 || value.questions.length > 2500) return null

  const questions: Question[] = []
  const vocabularyByQuestionId: Record<string, VocabularyItem[]> = {}
  const ids = new Set<string>()

  for (const candidate of value.questions) {
    if (!isRecord(candidate)) return null

    const id = readString(candidate.id, 64)
    const tag = readString(candidate.tag, 40)
    const english = readString(candidate.english, 2000)
    const explanation = readString(candidate.explanation, 2000)
    const kind = candidate.kind
    const level = candidate.level
    const answer = candidate.answer
    const qualityScore = candidate.qualityScore === undefined ? undefined : candidate.qualityScore
    const vocabulary = parseVocabulary(candidate.vocabulary)
    const exams = candidate.exams === undefined
      ? undefined
      : Array.isArray(candidate.exams)
        && candidate.exams.length > 0
        && candidate.exams.every((exam) => typeof exam === 'string' && validExamLibraries.has(exam as ExamLibrary))
        ? [...new Set(candidate.exams as QuestionExam[])]
        : null
    const source = candidate.source === undefined
      ? undefined
      : isRecord(candidate.source)
        ? {
            name: readString(candidate.source.name, 100),
            url: readHttpsUrl(candidate.source.url, 500),
            license: readString(candidate.source.license, 100),
            licenseUrl: readHttpsUrl(candidate.source.licenseUrl, 500),
            attribution: readString(candidate.source.attribution, 1000),
            adaptation: readString(candidate.source.adaptation, 500),
          }
        : null

    if (
      !id
      || !/^[a-zA-Z0-9_-]+$/.test(id)
      || ids.has(id)
      || typeof kind !== 'string'
      || !questionKinds.has(kind as QuestionKind)
      || typeof level !== 'string'
      || !questionLevels.has(level as QuestionLevel)
      || !tag
      || !english
      || !explanation
      || !Number.isInteger(answer)
      || Number(answer) < 0
      || Number(answer) > 3
      || (qualityScore !== undefined && (
        typeof qualityScore !== 'number'
        || !Number.isFinite(qualityScore)
        || qualityScore < 0
        || qualityScore > 100
      ))
      || !Array.isArray(candidate.options)
      || candidate.options.length !== 4
      || !vocabulary
      || exams === null
      || source === null
      || (parserOptions.requireSource && !source)
      || (source && Object.values(source).some((field) => field === null))
    ) {
      return null
    }

    const options = candidate.options.map((option) => readString(option, 500))
    if (options.some((option) => option === null) || new Set(options).size !== 4) return null

    const question: Question = {
      id,
      kind: kind as QuestionKind,
      level: level as QuestionLevel,
      tag,
      english,
      options: options as [string, string, string, string],
      answer: Number(answer) as 0 | 1 | 2 | 3,
      explanation,
      ...(qualityScore !== undefined ? { qualityScore } : {}),
      ...(exams ? { exams } : {}),
      ...(source ? { source: source as NonNullable<Question['source']> } : {}),
    }

    ids.add(id)
    questions.push(question)
    vocabularyByQuestionId[id] = vocabulary
  }

  return {
    questions,
    questionIds: questions.map((question) => question.id),
    questionById: new Map(questions.map((question) => [question.id, question])),
    vocabularyByQuestionId,
  }
}

export function createLocalQuestionBank(): QuestionBank {
  return {
    questions: localQuestions,
    questionIds: localQuestionIds,
    questionById: localQuestionById,
    vocabularyByQuestionId: localVocabularyByQuestionId,
  }
}

export function createLocalSentenceBank(): QuestionBank {
  const questions: Question[] = bundledSentenceQuestions.map((question) => ({
    ...question,
    options: [...question.options],
    exams: [...question.exams],
    source: { ...question.source },
  }))

  return {
    questions,
    questionIds: questions.map((question) => question.id),
    questionById: new Map(questions.map((question) => [question.id, question])),
    vocabularyByQuestionId: Object.fromEntries(bundledSentenceQuestions.map((question) => [
      question.id,
      question.vocabulary.map((item) => ({ ...item })),
    ])),
  }
}

export function mergeQuestionBanks(...banks: readonly QuestionBank[]): QuestionBank {
  const questionById = new Map<string, Question>()
  const vocabularyByQuestionId: Record<string, VocabularyItem[]> = {}

  banks.forEach((bank) => {
    bank.questions.forEach((question) => {
      if (questionById.has(question.id)) return
      questionById.set(question.id, question)
      vocabularyByQuestionId[question.id] = bank.vocabularyByQuestionId[question.id] ?? []
    })
  })

  const questions = [...questionById.values()]
  return {
    questions,
    questionIds: questions.map((question) => question.id),
    questionById,
    vocabularyByQuestionId,
  }
}

function defaultQuestionBankUrl(): string {
  const configuredUrl = import.meta.env.VITE_QUESTION_BANK_URL?.trim()
  return configuredUrl || `${import.meta.env.BASE_URL || './'}question-bank.json`
}

function defaultSentenceBankUrl(): string {
  const configuredUrl = import.meta.env.VITE_SENTENCE_BANK_URL?.trim()
  return configuredUrl || `${import.meta.env.BASE_URL || './'}sentence-bank.json`
}

function defaultStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export async function loadQuestionBank(
  options: LoadQuestionBankOptions = {},
): Promise<LoadedQuestionBank> {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const fetcher = options.fetcher ?? globalThis.fetch
  const url = options.url ?? defaultQuestionBankUrl()

  if (typeof fetcher === 'function') {
    try {
      const response = await fetchJsonWithTimeout(fetcher, url, {
        cache: 'default',
        headers: { Accept: 'application/json' },
      }, options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS, MAX_QUESTION_BANK_BYTES)

      if (response.ok) {
        const payload = response.payload
        const bank = parseQuestionBankPayload(payload)

        if (bank) {
          try {
            const serialized = JSON.stringify(payload)
            if (serialized.length <= MAX_LOCAL_CACHE_LENGTH) {
              storage?.setItem(QUESTION_BANK_CACHE_KEY, serialized)
            }
          } catch {
            // Online questions remain usable when browser storage is unavailable.
          }

          return { ...bank, source: 'online' }
        }
      }
    } catch {
      // Cached or bundled questions are used below.
    }
  }

  try {
    const cached = storage?.getItem(QUESTION_BANK_CACHE_KEY)
    const bank = cached ? parseQuestionBankPayload(JSON.parse(cached)) : null
    if (bank) return { ...bank, source: 'cache' }
  } catch {
    // Invalid or unavailable cache falls through to bundled questions.
  }

  return { ...createLocalQuestionBank(), source: 'local' }
}

export async function loadSentenceBank(
  options: LoadQuestionBankOptions = {},
): Promise<LoadedQuestionBank> {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const fetcher = options.fetcher ?? globalThis.fetch
  const url = options.url ?? defaultSentenceBankUrl()

  if (typeof fetcher === 'function') {
    try {
      const response = await fetchJsonWithTimeout(fetcher, url, {
        cache: 'default',
        headers: { Accept: 'application/json' },
      }, options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS, MAX_SENTENCE_BANK_BYTES)

      if (response.ok) {
        const payload = response.payload
        const bank = parseQuestionBankPayload(payload, { requireSource: true })
        if (bank) {
          try {
            const serialized = JSON.stringify(payload)
            if (serialized.length <= MAX_LOCAL_CACHE_LENGTH) {
              storage?.setItem(SENTENCE_BANK_CACHE_KEY, serialized)
            }
          } catch {
            // The online bank remains usable when storage is full or blocked.
          }
          return { ...bank, source: 'online' }
        }
      }
    } catch {
      // Cached or bundled sentences are used below.
    }
  }

  try {
    const cached = storage?.getItem(SENTENCE_BANK_CACHE_KEY)
    const bank = cached
      ? parseQuestionBankPayload(JSON.parse(cached), { requireSource: true })
      : null
    if (bank) return { ...bank, source: 'cache' }
  } catch {
    // Invalid or unavailable cache falls through to bundled sentences.
  }

  return { ...createLocalSentenceBank(), source: 'local' }
}
