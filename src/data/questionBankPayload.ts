import { questions, type Question } from './questions'
import { vocabularyByQuestionId, type VocabularyItem } from './vocabulary'

export interface SerializedQuestion extends Question {
  vocabulary: VocabularyItem[]
}

export interface QuestionBankPayload {
  version: 1
  source?: {
    name: string
    url: string
    license: string
    snapshot?: string
  }
  updatedAt?: string
  questions: SerializedQuestion[]
}

export function createBundledQuestionBankPayload(): QuestionBankPayload {
  return {
    version: 1,
    questions: questions.map((question) => ({
      ...question,
      vocabulary: vocabularyByQuestionId[question.id] ?? [],
    })),
  }
}
