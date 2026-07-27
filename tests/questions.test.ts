import { describe, expect, it } from 'vitest'
import { questions } from '../src/data/questions'
import { vocabularyByQuestionId } from '../src/data/vocabulary'

describe('question bank', () => {
  it('contains 80 complete, uniquely identified questions', () => {
    expect(questions).toHaveLength(80)
    expect(new Set(questions.map((question) => question.id)).size).toBe(80)
    expect(new Set(questions.map((question) => question.english)).size).toBe(80)

    for (const question of questions) {
      expect(question.english.trim().length).toBeGreaterThan(20)
      expect(question.options).toHaveLength(4)
      expect(question.answer).toBeGreaterThanOrEqual(0)
      expect(question.answer).toBeLessThan(4)
      expect(question.explanation.trim().length).toBeGreaterThan(20)
      expect(new Set(question.options).size).toBe(4)
    }
  })

  it('provides at least two complete vocabulary hints for every question', () => {
    expect(Object.keys(vocabularyByQuestionId).sort()).toEqual(questions.map((question) => question.id).sort())
    expect(Object.values(vocabularyByQuestionId).flat()).toHaveLength(160)

    for (const question of questions) {
      const vocabulary = vocabularyByQuestionId[question.id]

      expect(vocabulary.length).toBeGreaterThanOrEqual(2)
      expect(new Set(vocabulary.map((item) => item.term)).size).toBe(vocabulary.length)

      for (const item of vocabulary) {
        expect(item.term.trim().length).toBeGreaterThan(1)
        expect(item.meaning.trim().length).toBeGreaterThan(1)
        expect(item.breakdown.trim().length).toBeGreaterThan(10)
      }
    }
  })
})
