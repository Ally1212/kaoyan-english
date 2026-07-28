import type { VocabularyWord } from './vocabularyBank'

export type WordTrainingMode = 'word-zh' | 'word-en'
export type QuestionPass = 'practice' | 'review'

export interface VocabularyQuestion {
  id: string
  prompt: string
  promptMeta: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  explanation: string
  lookupTerm: string
}

function hashText(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rotate<T>(values: T[], amount: number): T[] {
  const offset = values.length === 0 ? 0 : amount % values.length
  return [...values.slice(offset), ...values.slice(0, offset)]
}

function primaryPartOfSpeech(value: string): string {
  return value.split(/[/:\s]/)[0]?.toLocaleLowerCase('en') ?? ''
}

export function createVocabularyQuestion(
  words: readonly VocabularyWord[],
  wordId: string,
  mode: WordTrainingMode,
  pass: QuestionPass,
): VocabularyQuestion {
  const word = words.find((candidate) => candidate.id === wordId)
  if (!word) throw new Error(`Unknown vocabulary word: ${wordId}`)

  const readAnswer = (candidate: VocabularyWord) => (
    mode === 'word-zh' ? candidate.translation : candidate.definition
  )
  const correctAnswer = readAnswer(word)
  const samePartOfSpeech = primaryPartOfSpeech(word.pos)
  const candidates = words.filter((candidate) => (
    candidate.id !== word.id
    && readAnswer(candidate) !== correctAnswer
    && primaryPartOfSpeech(candidate.pos) === samePartOfSpeech
  ))
  const fallbackCandidates = words.filter((candidate) => (
    candidate.id !== word.id && readAnswer(candidate) !== correctAnswer
  ))
  const pool = candidates.length >= 3 ? candidates : fallbackCandidates
  const rotated = rotate(pool, hashText(`${word.id}:${mode}`))
  const distractors: string[] = []

  for (const candidate of rotated) {
    const answer = readAnswer(candidate)
    if (!distractors.includes(answer)) distractors.push(answer)
    if (distractors.length === 3) break
  }

  if (distractors.length < 3) throw new Error('Not enough unique vocabulary distractors')

  const practiceAnswerIndex = hashText(`${word.id}:${mode}:practice`) % 4
  const answerIndex = (
    pass === 'review' ? (practiceAnswerIndex + 1) % 4 : practiceAnswerIndex
  ) as 0 | 1 | 2 | 3
  const options = [...distractors]
  options.splice(answerIndex, 0, correctAnswer)

  const phonetic = word.phonetic ? `/${word.phonetic}/` : '无音标'
  const partOfSpeech = word.pos || '词性未标注'
  const explanation = mode === 'word-zh'
    ? `${word.word} ${phonetic} · ${partOfSpeech}。核心含义：${word.translation}。英文释义：${word.definition}。`
    : `${word.word} ${phonetic} · ${partOfSpeech}。${word.definition} 对应中文“${word.translation}”。`

  return {
    id: word.id,
    prompt: word.word,
    promptMeta: `${phonetic} · ${partOfSpeech}`,
    options: options as [string, string, string, string],
    answer: answerIndex,
    explanation,
    lookupTerm: word.word,
  }
}
