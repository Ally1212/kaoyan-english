import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenCC from 'opencc-js'

const sourcePath = process.argv[2]

if (!sourcePath) {
  throw new Error('Usage: node scripts/generate-sentence-bank.mjs <cmn.txt>')
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vocabularyPath = resolve(projectRoot, 'public/vocabulary-bank.json')
const outputPath = resolve(projectRoot, 'public/sentence-bank.json')
const fallbackPath = resolve(projectRoot, 'src/data/sentenceFallback.ts')
const vocabularyPayload = JSON.parse(readFileSync(vocabularyPath, 'utf8'))
const sourceRows = readFileSync(resolve(sourcePath), 'utf8').trim().split('\n')
const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' })
const examTags = ['cet4', 'cet6', 'ky', 'ielts', 'toefl']
const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'do', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'him', 'his', 'i', 'if', 'in', 'is', 'it', 'its', 'me',
  'my', 'not', 'of', 'on', 'or', 'our', 'she', 'so', 'that', 'the', 'their', 'them', 'they',
  'this', 'to', 'was', 'we', 'were', 'will', 'with', 'you', 'your',
])
const excludedNames = /\b(Tom|Mary|John|Mike|Bob|Alice|Jane|Betty|Kate|Bill|Jack)\b/
const wordById = new Map(vocabularyPayload.words.map((word) => [word.word.toLocaleLowerCase('en'), word]))

function hashText(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function findWord(token) {
  const exact = wordById.get(token)

  const candidates = []
  if (token.endsWith('ies')) candidates.push(`${token.slice(0, -3)}y`)
  if (token.endsWith('ied')) candidates.push(`${token.slice(0, -3)}y`)
  if (token.endsWith('ing')) candidates.push(token.slice(0, -3), `${token.slice(0, -3)}e`, token.slice(0, -4))
  if (token.endsWith('ed')) candidates.push(token.slice(0, -2), token.slice(0, -1), token.slice(0, -3))
  if (token.endsWith('es')) candidates.push(token.slice(0, -2), token.slice(0, -1))
  if (token.endsWith('s')) candidates.push(token.slice(0, -1))
  if (token.endsWith('ly')) candidates.push(token.slice(0, -2))

  const baseForm = candidates.map((candidate) => wordById.get(candidate)).find(Boolean)
  const exactLooksSecondary = exact && (
    exact.frequency === 0
    || /^\s*\[[^\]]+\]/.test(exact.translation)
  )

  return exactLooksSecondary && baseForm ? baseForm : exact ?? baseForm
}

function bigrams(value) {
  const result = new Set()
  for (let index = 0; index < value.length - 1; index += 1) result.add(value.slice(index, index + 2))
  return result
}

function similarity(left, right) {
  const leftParts = bigrams(left)
  const rightParts = bigrams(right)
  let overlap = 0
  leftParts.forEach((part) => { if (rightParts.has(part)) overlap += 1 })
  return overlap / Math.max(1, new Set([...leftParts, ...rightParts]).size)
}

function wordSimilarity(left, right) {
  const leftWords = new Set(left.toLocaleLowerCase('en').match(/[a-z]+/g) ?? [])
  const rightWords = new Set(right.toLocaleLowerCase('en').match(/[a-z]+/g) ?? [])
  let overlap = 0
  leftWords.forEach((word) => { if (rightWords.has(word)) overlap += 1 })
  return overlap / Math.max(1, new Set([...leftWords, ...rightWords]).size)
}

function sharedExamCount(left, right) {
  const rightExams = new Set(right)
  return left.filter((exam) => rightExams.has(exam)).length
}

function createOptions(question, pool) {
  const ranked = pool
    .filter((candidate) => candidate.id !== question.id && candidate.chinese !== question.chinese)
    .map((candidate) => ({
      candidate,
      lengthDistance: Math.abs(candidate.chinese.length - question.chinese.length),
      tokenDistance: Math.abs(candidate.tokenCount - question.tokenCount),
      levelMismatch: candidate.level === question.level ? 0 : 1,
      examOverlap: sharedExamCount(candidate.exams, question.exams),
      chineseSimilarity: similarity(candidate.chinese, question.chinese),
      englishSimilarity: wordSimilarity(candidate.english, question.english),
    }))
    .filter((candidate) => candidate.lengthDistance <= 18 && candidate.chineseSimilarity < 0.72)
    .sort((left, right) => {
      const leftScore = left.lengthDistance
        + left.tokenDistance * 2
        + left.levelMismatch * 5
        - left.examOverlap * 4
        - Math.min(left.englishSimilarity, 0.5) * 28
        - Math.min(left.chineseSimilarity, 0.35) * 10
      const rightScore = right.lengthDistance
        + right.tokenDistance * 2
        + right.levelMismatch * 5
        - right.examOverlap * 4
        - Math.min(right.englishSimilarity, 0.5) * 28
        - Math.min(right.chineseSimilarity, 0.35) * 10
      return leftScore - rightScore || left.candidate.id.localeCompare(right.candidate.id)
    })

  const distractors = []
  const selectedCandidates = []
  for (const rankedCandidate of ranked) {
    const { candidate } = rankedCandidate
    if (!distractors.includes(candidate.chinese)) {
      distractors.push(candidate.chinese)
      selectedCandidates.push(rankedCandidate)
    }
    if (distractors.length === 3) break
  }
  if (distractors.length < 3) return null

  const answer = hashText(question.id) % 4
  const options = [...distractors]
  options.splice(answer, 0, question.chinese)
  const averageLengthDistance = selectedCandidates.reduce((total, item) => total + item.lengthDistance, 0) / 3
  const averageExamOverlap = selectedCandidates.reduce((total, item) => total + item.examOverlap, 0) / 3
  const sameLevelCount = selectedCandidates.filter((item) => item.levelMismatch === 0).length
  const averageEnglishSimilarity = selectedCandidates.reduce((total, item) => total + item.englishSimilarity, 0) / 3

  return {
    answer,
    options,
    distractorQuality: (
      Math.max(0, 1 - averageLengthDistance / 20) * 12
      + averageExamOverlap * 3
      + sameLevelCount * 4
      + Math.min(averageEnglishSimilarity, 0.5) * 18
    ),
  }
}

const candidates = []
const seenEnglish = new Set()

for (const row of sourceRows) {
  const [englishRaw, chineseRaw, attribution] = row.split('\t')
  const english = englishRaw?.trim()
  const chinese = toSimplified(chineseRaw?.trim() ?? '')
  if (!english || !chinese || !attribution || seenEnglish.has(english.toLocaleLowerCase('en'))) continue

  const tokens = english.toLocaleLowerCase('en').match(/[a-z]+(?:'[a-z]+)?/g) ?? []
  if (
    tokens.length < 7
    || tokens.length > 24
    || english.length > 180
    || chinese.length < 7
    || chinese.length > 80
    || excludedNames.test(english)
  ) continue

  const matchedWords = tokens.map(findWord).filter(Boolean)
  if (matchedWords.length / tokens.length < 0.4) continue

  const examCounts = Object.fromEntries(examTags.map((tag) => [
    tag,
    matchedWords.filter((word) => word.tags.includes(tag)).length,
  ]))
  const exams = examTags.filter((tag) => examCounts[tag] >= 2)
  if (exams.length === 0) continue

  const vocabulary = [...new Map(matchedWords
    .filter((word) => !stopWords.has(word.word.toLocaleLowerCase('en')))
    .map((word) => [word.word.toLocaleLowerCase('en'), word])).values()]
    .sort((left, right) => right.word.length - left.word.length || right.frequency - left.frequency)
    .slice(0, 3)
    .map((word) => ({
      term: word.word,
      meaning: word.translation,
      breakdown: `词典参考义：${word.translation}。具体含义请结合整句判断。`,
    }))
  if (vocabulary.length === 0) continue

  const sourceIds = [...attribution.matchAll(/#(\d+)/g)].map((match) => match[1]).slice(0, 2)
  const id = `tat-${sourceIds.join('-') || hashText(english)}`
  const level = tokens.length <= 8 ? '基础' : tokens.length <= 11 ? '进阶' : '挑战'

  candidates.push({
    id,
    english,
    chinese,
    attribution,
    exams,
    level,
    vocabulary,
    tokenCount: tokens.length,
    vocabularyCoverage: matchedWords.length / tokens.length,
  })
  seenEnglish.add(english.toLocaleLowerCase('en'))
}

const balanced = []
const perExamCount = Object.fromEntries(examTags.map((tag) => [tag, 0]))
for (const candidate of candidates.sort((left, right) => hashText(left.id) - hashText(right.id))) {
  const underfilledExams = candidate.exams.filter((exam) => perExamCount[exam] < 260)
  if (underfilledExams.length === 0 && balanced.length >= 1200) continue
  balanced.push(candidate)
  candidate.exams.forEach((exam) => { perExamCount[exam] += 1 })
  if (balanced.length >= 1200 && examTags.every((exam) => perExamCount[exam] >= 180)) break
}

const preparedQuestions = balanced.map((candidate) => {
  const result = createOptions(candidate, balanced)
  if (!result) return null
  const keyExpressions = candidate.vocabulary
    .map((item) => `${item.term}：${item.meaning}`)
    .join('；')

  return {
    candidate,
    result,
    keyExpressions,
    rawQuality: (
      candidate.vocabularyCoverage * 35
      + candidate.vocabulary.length * 5
      + Math.max(0, 1 - Math.abs(candidate.tokenCount - 12) / 12) * 10
      + result.distractorQuality
    ),
  }
}).filter(Boolean)

const rankedQuestions = [...preparedQuestions]
  .sort((left, right) => right.rawQuality - left.rawQuality || left.candidate.id.localeCompare(right.candidate.id))
const featuredIds = new Set(rankedQuestions.slice(0, 500).map((item) => item.candidate.id))
const qualityRankById = new Map(
  rankedQuestions.map((item, index, values) => [
    item.candidate.id,
    Math.round(95 - (index / Math.max(1, values.length - 1)) * 40),
  ]),
)

const questions = preparedQuestions.map(({ candidate, result, keyExpressions }) => {
  const qualityScore = qualityRankById.get(candidate.id)

  return {
    id: candidate.id,
    kind: '句子',
    level: candidate.level,
    tag: featuredIds.has(candidate.id) ? '精选例句' : '开放例句',
    english: candidate.english,
    options: result.options,
    answer: result.answer,
    explanation: `正确理解：${candidate.chinese}。关键表达：${keyExpressions}。`,
    qualityScore,
    exams: candidate.exams,
    vocabulary: candidate.vocabulary,
    source: {
      name: 'Tatoeba / ManyThings',
      url: 'https://www.manythings.org/anki/',
      license: 'CC BY 2.0 FR',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/',
      attribution: candidate.attribution,
      adaptation: '已转换为简体中文，并由本项目生成四选一干扰项和词典提示。',
    },
  }
})

const payload = {
  version: 1,
  source: {
    name: 'Tatoeba / ManyThings',
    url: 'https://www.manythings.org/anki/',
    license: 'CC BY 2.0 FR',
    snapshot: '2026-02-13',
  },
  questions,
}

const fallbackById = new Map()
for (const exam of examTags) {
  for (const level of ['基础', '进阶', '挑战']) {
    questions
      .filter((question) => question.exams.includes(exam) && question.level === level)
      .slice(0, 12)
      .forEach((question) => fallbackById.set(question.id, question))
  }
}

mkdirSync(dirname(outputPath), { recursive: true })
mkdirSync(dirname(fallbackPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(payload))
writeFileSync(
  fallbackPath,
  `// Generated from Tatoeba / ManyThings ${payload.source.snapshot}. Do not edit manually.\nexport const bundledSentenceQuestions = ${JSON.stringify([...fallbackById.values()], null, 2)} as const\n`,
)

console.log(JSON.stringify({
  questions: questions.length,
  fallback: fallbackById.size,
  counts: Object.fromEntries(examTags.map((exam) => [
    exam,
    questions.filter((question) => question.exams.includes(exam)).length,
  ])),
}, null, 2))
