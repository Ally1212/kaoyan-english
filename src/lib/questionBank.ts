import {
  questionById as localQuestionById,
  questionIds as localQuestionIds,
  questions as localQuestions,
  type Question,
  type QuestionKind,
  type QuestionLevel,
} from '../data/questions'
import {
  vocabularyByQuestionId as localVocabularyByQuestionId,
  type VocabularyItem,
} from '../data/vocabulary'

export const QUESTION_BANK_CACHE_KEY = 'kaoyan-english-question-bank-v1'

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

interface FetchResponse {
  ok: boolean
  json: () => Promise<unknown>
}

type QuestionBankFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<FetchResponse>

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface LoadQuestionBankOptions {
  url?: string
  fetcher?: QuestionBankFetcher
  storage?: StorageLike | null
}

const questionKinds = new Set<QuestionKind>(['句子', '短段落'])
const questionLevels = new Set<QuestionLevel>(['基础', '进阶', '挑战'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null

  const result = value.trim()
  return result.length > 0 && result.length <= maxLength ? result : null
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

export function parseQuestionBankPayload(value: unknown): QuestionBank | null {
  if (!isRecord(value) || value.version !== 1) return null
  if (!Array.isArray(value.questions) || value.questions.length === 0 || value.questions.length > 2000) return null

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
    const vocabulary = parseVocabulary(candidate.vocabulary)

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
      || !Array.isArray(candidate.options)
      || candidate.options.length !== 4
      || !vocabulary
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

function defaultQuestionBankUrl(): string {
  const configuredUrl = import.meta.env.VITE_QUESTION_BANK_URL?.trim()
  return configuredUrl || `${import.meta.env.BASE_URL || './'}question-bank.json`
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
      const response = await fetcher(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })

      if (response.ok) {
        const payload = await response.json()
        const bank = parseQuestionBankPayload(payload)

        if (bank) {
          try {
            storage?.setItem(QUESTION_BANK_CACHE_KEY, JSON.stringify(payload))
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
