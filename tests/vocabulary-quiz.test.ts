import { describe, expect, it } from 'vitest'
import type { VocabularyWord } from '../src/lib/vocabularyBank'
import { createVocabularyQuestion } from '../src/lib/vocabularyQuiz'

const words: VocabularyWord[] = [
  ['abandon', '放弃', 'to leave something completely'],
  ['acquire', '获得', 'to get or obtain something'],
  ['maintain', '维持', 'to keep something in its current state'],
  ['restrict', '限制', 'to limit what someone can do'],
  ['evaluate', '评估', 'to judge the quality or value of something'],
  ['indicate', '表明', 'to show that something exists or is true'],
].map(([word, translation, definition], index) => ({
  id: word,
  word,
  phonetic: `test-${index}`,
  translation,
  definition,
  pos: 'v',
  tags: ['ky'],
  frequency: index + 1,
}))

describe('vocabulary multiple-choice questions', () => {
  it('creates a deterministic four-option Chinese meaning question', () => {
    const first = createVocabularyQuestion(words, 'abandon', 'word-zh', 'practice')
    const second = createVocabularyQuestion(words, 'abandon', 'word-zh', 'practice')

    expect(first).toEqual(second)
    expect(first.options).toHaveLength(4)
    expect(new Set(first.options).size).toBe(4)
    expect(first.options[first.answer]).toBe('放弃')
    expect(first.explanation).toContain('abandon')
    expect(first.explanation).toContain('放弃')
  })

  it('creates an English-definition question and reshuffles it for review', () => {
    const practice = createVocabularyQuestion(words, 'abandon', 'word-en', 'practice')
    const review = createVocabularyQuestion(words, 'abandon', 'word-en', 'review')

    expect(practice.options[practice.answer]).toBe('to leave something completely')
    expect(review.options[review.answer]).toBe('to leave something completely')
    expect(review.options).not.toEqual(practice.options)
  })
})
