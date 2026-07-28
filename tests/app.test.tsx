import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { bundledVocabularyWords } from '../src/data/vocabularyFallback'
import { questionById, questionIds } from '../src/data/questions'
import { MISTAKE_STORAGE_KEY } from '../src/lib/mistakes'
import { QUESTION_FEEDBACK_STORAGE_KEY } from '../src/lib/questionFeedback'
import { STORAGE_KEY } from '../src/lib/storage'
import { TRAINING_PREFERENCES_STORAGE_KEY } from '../src/lib/trainingPreferences'
import { createLocalVocabularyBank, getWordsForExam } from '../src/lib/vocabularyBank'
import { createVocabularyQuestion } from '../src/lib/vocabularyQuiz'

const fallbackBank = createLocalVocabularyBank()
const fallbackKaoyanWords = getWordsForExam(fallbackBank.words, 'ky')
const fallbackKaoyanIds = fallbackKaoyanWords.map((word) => word.id)
const fallbackCet4Count = getWordsForExam(fallbackBank.words, 'cet4').length

function setProgress(order: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    order,
    cursor: 0,
    answered: 0,
    correct: 0,
    selectedIndex: null,
  }))
}

function setWordTraining() {
  window.localStorage.setItem(TRAINING_PREFERENCES_STORAGE_KEY, JSON.stringify({
    exam: 'ky',
    mode: 'word-zh',
    level: '全部',
  }))
  setProgress(fallbackKaoyanIds)
}

describe('training flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    window.localStorage.clear()
    setProgress(questionIds)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps the existing reading flow and WASD shortcuts', () => {
    render(<App />)

    const firstQuestion = questionById.get(questionIds[0])!
    fireEvent.keyDown(window, { key: ['w', 'a', 's', 'd'][firstQuestion.answer] })

    expect(screen.getByText('理解正确')).toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 W')).toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 A')).toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 S')).toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 D')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }))
    expect(screen.queryByText(firstQuestion.english)).not.toBeInTheDocument()
  })

  it('shows five examination books, training modes, and reading difficulty separately', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /选择词库和类型/ }))

    expect(screen.getByRole('radio', { name: /^四级句库，/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^六级句库，/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^考研句库，/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^雅思句库，/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^托福句库，/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '句意理解' })).toBeChecked()
    expect(screen.getByRole('radiogroup', { name: '阅读难度' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /^四级句库，/ }))
    expect(screen.getByRole('radio', { name: '句意理解' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '句意理解' })).toBeEnabled()
    expect(screen.getByRole('radiogroup', { name: '阅读难度' })).toBeInTheDocument()
  })

  it('uses an accessible in-page confirmation before clearing records', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /选择词库和类型/ }))
    fireEvent.click(screen.getByRole('button', { name: '清空记录' }))

    expect(screen.getByRole('alertdialog', { name: '清空训练记录？' })).toBeInTheDocument()
    expect(screen.getByText('当前答题进度、错题和题目反馈都会被删除。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '清空记录' })).toHaveFocus())
  })

  it('clears saved progress only after explicit confirmation', () => {
    window.localStorage.setItem(MISTAKE_STORAGE_KEY, JSON.stringify([{ key: 'saved-mistake' }]))
    window.localStorage.setItem(QUESTION_FEEDBACK_STORAGE_KEY, JSON.stringify([{
      questionId: questionIds[0],
      reportedAt: '2026-07-28T00:00:00.000Z',
    }]))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /选择词库和类型/ }))
    fireEvent.click(screen.getByRole('button', { name: '清空记录' }))
    fireEvent.click(screen.getByRole('button', { name: '确认清空' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(MISTAKE_STORAGE_KEY)).toBe('[]')
    expect(window.localStorage.getItem(QUESTION_FEEDBACK_STORAGE_KEY)).toBe('[]')
  })

  it('switches to a vocabulary book and presents word meaning questions', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /选择词库和类型/ }))
    fireEvent.click(screen.getByRole('radio', { name: /^四级句库，/ }))
    fireEvent.click(screen.getByRole('radio', { name: '单词认义' }))
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }))

    expect(screen.getByRole('button', { name: /当前训练：四级词库 · 单词认义/ })).toBeInTheDocument()
    expect(document.querySelector('.english-word')).toBeInTheDocument()
    expect(screen.getByText(/1 \/ 5/)).toBeInTheDocument()
  })

  it('lets readers locally reduce and restore a questionable sentence', async () => {
    render(<App />)
    const question = questionById.get(questionIds[0])!
    fireEvent.click(screen.getByRole('button', { name: question.options[question.answer] }))

    const reportButton = screen.getByRole('button', { name: '题目有问题' })
    fireEvent.click(reportButton)
    expect(screen.getByRole('button', { name: '已减少出现 · 撤销' })).toBePressed()
    await waitFor(() => expect(JSON.parse(
      window.localStorage.getItem(QUESTION_FEEDBACK_STORAGE_KEY) ?? '[]',
    )).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: '已减少出现 · 撤销' }))
    expect(screen.getByRole('button', { name: '题目有问题' })).not.toBePressed()
  })

  it('supplements a partial online vocabulary bank with local exam fallbacks', async () => {
    setWordTraining()
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      if (String(input).includes('vocabulary-bank.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            version: 1,
            words: [{
              word: 'webnative',
              phonetic: '',
              translation: '网络原生的',
              definition: 'designed to work naturally on the web',
              pos: 'adj',
              tags: ['cet4'],
              frequency: 1,
            }],
          }),
        })
      }
      return new Promise(() => undefined)
    }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /选择词库和类型/ }))

    await waitFor(() => expect(screen.getByRole('radio', {
      name: `四级词库，${fallbackCet4Count + 1}词`,
    })).toBeInTheDocument())
    expect(screen.getByRole('radio', { name: /^考研词库，/ })).toBeInTheDocument()
  })

  it('restores an online-only saved word after the full bank finishes loading', async () => {
    setWordTraining()
    setProgress(['online-exclusive', ...fallbackKaoyanIds])
    let resolveVocabulary: ((response: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined
    const vocabularyResponse = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveVocabulary = resolve
    })
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => (
      String(input).includes('vocabulary-bank.json')
        ? vocabularyResponse
        : new Promise(() => undefined)
    )))

    render(<App />)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').order[0]).toBe('online-exclusive')

    await act(async () => {
      resolveVocabulary?.({
        ok: true,
        json: async () => ({
          version: 1,
          words: [{
            word: 'online-exclusive',
            phonetic: 'online',
            translation: '线上专属词',
            definition: 'available only in the complete online bank',
            pos: 'adj',
            tags: ['ky'],
            frequency: 1,
          }],
        }),
      })
      await vocabularyResponse
    })

    await waitFor(() => expect(screen.getByText('online-exclusive')).toBeInTheDocument())
    await waitFor(() => expect(JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}',
    ).order[0]).toBe('online-exclusive'))
  })

  it('freezes an answered question while a larger vocabulary bank arrives', async () => {
    setWordTraining()
    let resolveVocabulary: ((response: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined
    const vocabularyResponse = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveVocabulary = resolve
    })
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => (
      String(input).includes('vocabulary-bank.json')
        ? vocabularyResponse
        : new Promise(() => undefined)
    )))

    render(<App />)
    const optionsBefore = Array.from(document.querySelectorAll('.option')).map((option) => option.textContent)
    const question = createVocabularyQuestion(fallbackKaoyanWords, fallbackKaoyanIds[0], 'word-zh', 'practice')
    fireEvent.click(screen.getByRole('button', { name: question.options[(question.answer + 1) % 4] }))

    await act(async () => {
      resolveVocabulary?.({
        ok: true,
        json: async () => ({
          version: 1,
          words: Array.from({ length: 8 }, (_, index) => ({
            word: `remote-word-${index}`,
            phonetic: `remote-${index}`,
            translation: `远程释义 ${index}`,
            definition: `remote definition ${index}`,
            pos: 'v',
            tags: ['ky'],
            frequency: index + 1,
          })),
        }),
      })
      await vocabularyResponse
    })

    await waitFor(() => expect(
      Array.from(document.querySelectorAll('.option')).map((option) => option.textContent),
    ).toEqual(optionsBefore))
  })

  it('collects mistakes after five questions and starts a focused self-test', () => {
    setWordTraining()
    render(<App />)

    for (let index = 0; index < 5; index += 1) {
      const wordId = fallbackKaoyanIds[index]
      const question = createVocabularyQuestion(fallbackKaoyanWords, wordId, 'word-zh', 'practice')
      const wrongIndex = (question.answer + 1) % 4
      fireEvent.click(screen.getByRole('button', { name: question.options[wrongIndex] }))
      fireEvent.click(screen.getByRole('button', { name: index === 4 ? /查看阶段自测/ : /下一题/ }))
    }

    expect(screen.getByRole('heading', { name: '阶段自测' })).toBeInTheDocument()
    expect(screen.getByText('本轮错 5 道，立即重新测试这些内容。')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(MISTAKE_STORAGE_KEY) ?? '[]')).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: /开始自测/ }))
    expect(screen.getByText('错题自测')).toBeInTheDocument()
    expect(screen.getByText('自测 1 / 5')).toBeInTheDocument()
  })

  it('shows the answer chosen during the self-test on the result sheet', () => {
    setWordTraining()
    render(<App />)

    const firstPracticeQuestion = createVocabularyQuestion(
      fallbackKaoyanWords,
      fallbackKaoyanIds[0],
      'word-zh',
      'practice',
    )
    const firstWrongAnswer = firstPracticeQuestion.options.find((_, index) => index !== firstPracticeQuestion.answer)!
    fireEvent.click(screen.getByRole('button', { name: firstWrongAnswer }))
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }))

    for (let index = 1; index < 5; index += 1) {
      const question = createVocabularyQuestion(fallbackKaoyanWords, fallbackKaoyanIds[index], 'word-zh', 'practice')
      fireEvent.click(screen.getByRole('button', { name: question.options[question.answer] }))
      fireEvent.click(screen.getByRole('button', { name: index === 4 ? /查看阶段自测/ : /下一题/ }))
    }

    fireEvent.click(screen.getByRole('button', { name: /开始自测/ }))
    const reviewQuestion = createVocabularyQuestion(fallbackKaoyanWords, fallbackKaoyanIds[0], 'word-zh', 'review')
    const reviewWrongAnswer = reviewQuestion.options.find((option, index) => (
      index !== reviewQuestion.answer && option !== firstWrongAnswer
    ))!
    fireEvent.click(screen.getByRole('button', { name: reviewWrongAnswer }))
    fireEvent.click(screen.getByRole('button', { name: /查看自测结果/ }))

    expect(screen.getByRole('heading', { name: '自测结果' })).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === `你的选择：${reviewWrongAnswer}`)).toBeInTheDocument()
    expect(screen.queryByText((_, element) => element?.textContent === `你的选择：${firstWrongAnswer}`)).not.toBeInTheDocument()
  })

  it('shows the next spaced-review step after a corrected self-test', () => {
    setWordTraining()
    render(<App />)

    for (let index = 0; index < 5; index += 1) {
      const question = createVocabularyQuestion(fallbackKaoyanWords, fallbackKaoyanIds[index], 'word-zh', 'practice')
      const answerIndex = index === 0 ? (question.answer + 1) % 4 : question.answer
      fireEvent.click(screen.getByRole('button', { name: question.options[answerIndex] }))
      fireEvent.click(screen.getByRole('button', { name: index === 4 ? /查看阶段自测/ : /下一题/ }))
    }

    fireEvent.click(screen.getByRole('button', { name: /开始自测/ }))
    const reviewQuestion = createVocabularyQuestion(fallbackKaoyanWords, fallbackKaoyanIds[0], 'word-zh', 'review')
    fireEvent.click(screen.getByRole('button', { name: reviewQuestion.options[reviewQuestion.answer] }))
    fireEvent.click(screen.getByRole('button', { name: /查看自测结果/ }))

    expect(screen.getByText('明日复习')).toBeInTheDocument()
  })

  it('shows a clean pass card instead of inventing review questions after five correct answers', () => {
    setWordTraining()
    render(<App />)

    for (let index = 0; index < 5; index += 1) {
      const wordId = fallbackKaoyanIds[index]
      const question = createVocabularyQuestion(fallbackKaoyanWords, wordId, 'word-zh', 'practice')
      fireEvent.click(screen.getByRole('button', { name: question.options[question.answer] }))
      fireEvent.click(screen.getByRole('button', { name: index === 4 ? /查看阶段自测/ : /下一题/ }))
    }

    expect(screen.getByText('5 / 5，本轮没有需要复习的错题。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /开始自测/ })).not.toBeInTheDocument()
  })

  it('adds a historical unresolved mistake to the stage review after a clean round', () => {
    setWordTraining()
    const historicalId = fallbackKaoyanIds[6]
    const historicalQuestion = createVocabularyQuestion(fallbackKaoyanWords, historicalId, 'word-zh', 'practice')
    window.localStorage.setItem(MISTAKE_STORAGE_KEY, JSON.stringify([{
      key: `word-zh:ky:${historicalId}`,
      itemId: historicalId,
      exam: 'ky',
      mode: 'word-zh',
      prompt: historicalQuestion.prompt,
      selectedAnswer: historicalQuestion.options[(historicalQuestion.answer + 1) % 4],
      correctAnswer: historicalQuestion.options[historicalQuestion.answer],
      explanation: historicalQuestion.explanation,
      wrongCount: 1,
      lastWrongAt: '2026-07-28T00:00:00.000Z',
      reviewStage: 0,
      nextReviewAt: '2026-07-28T00:00:00.000Z',
      status: '待复习',
    }]))
    render(<App />)

    for (let index = 0; index < 5; index += 1) {
      const question = createVocabularyQuestion(fallbackKaoyanWords, fallbackKaoyanIds[index], 'word-zh', 'practice')
      fireEvent.click(screen.getByRole('button', { name: question.options[question.answer] }))
      fireEvent.click(screen.getByRole('button', { name: index === 4 ? /查看阶段自测/ : /下一题/ }))
    }

    expect(screen.getByText('本轮 5 / 5，并加入 1 道历史待复习题。')).toBeInTheDocument()
    expect(screen.getByText('历史')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /开始自测/ }))
    expect(screen.getByText(historicalQuestion.prompt)).toBeInTheDocument()
  })

  it('keeps reading vocabulary hints available but hides them during a self-test', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /打开生词提示/ }))
    fireEvent.click(screen.getByRole('button', { name: '提示一个' }))

    expect(screen.getByText(questionById.get(questionIds[0])!.english)).toBeInTheDocument()
    expect(document.querySelectorAll('.vocabulary-list > li')).toHaveLength(1)
    await waitFor(() => expect(screen.getByRole('button', { name: /在线词典/ })).toBeInTheDocument())
  })

  it('uses the generated fallback data from the ECDICT snapshot', () => {
    expect(bundledVocabularyWords.length).toBeGreaterThanOrEqual(25)
    expect(new Set(bundledVocabularyWords.flatMap((word) => word.tags))).toEqual(
      new Set(['cet4', 'cet6', 'ky', 'ielts', 'toefl']),
    )
  })
})
