import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const examTags = ['cet4', 'cet6', 'ky', 'ielts', 'toefl']
const sourcePath = process.argv[2]

if (!sourcePath) {
  throw new Error('Usage: node scripts/generate-vocabulary-bank.mjs <ecdict.csv>')
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(projectRoot, 'public/vocabulary-bank.json')
const fallbackPath = resolve(projectRoot, 'src/data/vocabularyFallback.ts')
const sourceText = readFileSync(resolve(sourcePath), 'utf8')

function readCsv(text, onRow) {
  let row = []
  let field = ''
  let quoted = false

  const finishField = () => {
    row.push(field)
    field = ''
  }

  const finishRow = () => {
    finishField()
    onRow(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += character
      }
      continue
    }

    if (character === '"') quoted = true
    else if (character === ',') finishField()
    else if (character === '\n') finishRow()
    else if (character !== '\r') field += character
  }

  if (field.length > 0 || row.length > 0) finishRow()
}

function firstMeaning(value, maxLength) {
  return value
    .split('\\n')
    .map((part) => part.trim())
    .find(Boolean)
    ?.slice(0, maxLength) ?? ''
}

let headers = null
const words = new Map()

readCsv(sourceText, (values) => {
  if (!headers) {
    headers = values
    return
  }

  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  const tags = examTags.filter((tag) => row.tag.split(/\s+/).includes(tag))
  if (tags.length === 0) return

  const word = row.word.trim()
  const translation = firstMeaning(row.translation, 180)
  const definition = firstMeaning(row.definition, 240)
  const id = word.toLocaleLowerCase('en')
  if (!word || !translation || !definition || words.has(id)) return

  words.set(id, {
    word,
    phonetic: row.phonetic.trim().slice(0, 100),
    translation,
    definition,
    pos: row.pos.trim().slice(0, 80),
    tags,
    frequency: /^\d+$/.test(row.frq) ? Number(row.frq) : 0,
  })
})

const sortedWords = [...words.values()].sort((left, right) => {
  if (left.frequency === 0 && right.frequency !== 0) return 1
  if (right.frequency === 0 && left.frequency !== 0) return -1
  if (left.frequency !== right.frequency) return left.frequency - right.frequency
  return left.word.localeCompare(right.word, 'en')
})

const payload = {
  version: 1,
  source: {
    name: 'ECDICT',
    url: 'https://github.com/skywind3000/ECDICT',
    license: 'MIT',
    snapshot: 'bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b',
  },
  words: sortedWords,
}

const fallbackById = new Map()
for (const tag of examTags) {
  sortedWords
    .filter((word) => word.tags.includes(tag))
    .slice(0, 120)
    .forEach((word) => fallbackById.set(word.word.toLocaleLowerCase('en'), word))
}

mkdirSync(dirname(outputPath), { recursive: true })
mkdirSync(dirname(fallbackPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(payload))
writeFileSync(
  fallbackPath,
  `// Generated from ECDICT ${payload.source.snapshot}. Do not edit manually.\nexport const bundledVocabularyWords = ${JSON.stringify([...fallbackById.values()], null, 2)} as const\n`,
)

const counts = Object.fromEntries(examTags.map((tag) => [
  tag,
  sortedWords.filter((word) => word.tags.includes(tag)).length,
]))

console.log(JSON.stringify({ words: sortedWords.length, fallback: fallbackById.size, counts }, null, 2))
