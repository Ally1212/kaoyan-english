// @ts-expect-error Vitest runs in Node; the browser app intentionally does not include Node globals.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const examLibraries = ['cet4', 'cet6', 'ky', 'ielts', 'toefl'] as const
const expectedVocabularyCounts = {
  cet4: 3846,
  cet6: 5403,
  ky: 4801,
  ielts: 5019,
  toefl: 6952,
}

describe('generated public training banks', () => {
  it('keeps the documented ECDICT snapshot complete and internally consistent', () => {
    const payload = JSON.parse(readFileSync('public/vocabulary-bank.json', 'utf8'))
    const words = payload.words as Array<{ word: string; tags: string[] }>

    expect(payload.version).toBe(1)
    expect(words).toHaveLength(10_641)
    expect(new Set(words.map((word) => word.word.toLocaleLowerCase('en'))).size).toBe(words.length)
    expect(Object.fromEntries(examLibraries.map((exam) => [
      exam,
      words.filter((word) => word.tags.includes(exam)).length,
    ]))).toEqual(expectedVocabularyCounts)
  })

  it('keeps 1,200 attributed sentence questions with useful difficulty pools', () => {
    const payload = JSON.parse(readFileSync('public/sentence-bank.json', 'utf8'))
    const questions = payload.questions as Array<{
      id: string
      level: '基础' | '进阶' | '挑战'
      tag: '精选例句' | '开放例句'
      qualityScore: number
      exams: string[]
      options: string[]
      answer: number
      source?: { attribution?: string }
      explanation: string
      vocabulary: Array<{ term: string; meaning: string; breakdown: string }>
    }>

    expect(payload.version).toBe(1)
    expect(questions).toHaveLength(1200)
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
    expect(questions.every((question) => (
      question.options.length === 4
      && new Set(question.options).size === 4
      && Number.isInteger(question.answer)
      && question.answer >= 0
      && question.answer <= 3
      && question.qualityScore >= 55
      && question.qualityScore <= 95
      && Boolean(question.source?.attribution)
      && question.explanation === `正确理解：${question.options[question.answer]}。关键表达：${question.vocabulary.map((item) => `${item.term}：${item.meaning}`).join('；')}。`
      && question.vocabulary.every((item) => item.breakdown.includes('具体含义请结合整句判断'))
    ))).toBe(true)
    expect(questions.filter((question) => question.tag === '精选例句')).toHaveLength(500)
    expect(questions.some((question) => question.vocabulary.some((item) => item.term === 'flowers'))).toBe(false)

    for (const exam of examLibraries) {
      const examQuestions = questions.filter((question) => question.exams.includes(exam))
      expect(examQuestions.length).toBeGreaterThanOrEqual(300)
      expect(examQuestions.filter((question) => question.level === '进阶').length).toBeGreaterThanOrEqual(40)
      expect(examQuestions.filter((question) => question.level === '挑战').length).toBeGreaterThanOrEqual(20)
    }
  })
})
