import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { questionById, questionIds } from '../src/data/questions'
import { STORAGE_KEY } from '../src/lib/storage'
import { TRAINING_LEVEL_STORAGE_KEY } from '../src/lib/trainingLevel'

const finishAnimation = (element: Element) => {
  fireEvent(element, new Event('animationend', { bubbles: true }))
  fireEvent(element, new Event('webkitAnimationEnd', { bubbles: true }))
}

const onlineQuestionBank = {
  version: 1,
  questions: [
    {
      id: 'online-1',
      kind: '句子',
      level: '基础',
      tag: '联网',
      english: 'Online questions can update without rebuilding the website.',
      options: ['在线题库无法更新。', '在线题库可以独立更新。', '网站必须停止工作。', '浏览器不能读取 JSON。'],
      answer: 1,
      explanation: '题库通过 JSON 获取，因此题目内容可以独立于网站界面更新。',
      vocabulary: [
        { term: 'rebuild', meaning: '重新构建', breakdown: '指重新执行网站的生产构建流程。' },
      ],
    },
  ],
}

describe('quiz flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      order: questionIds,
      cursor: 0,
      answered: 0,
      correct: 0,
      selectedIndex: null,
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('judges an answer, updates stats, and advances to a different question', async () => {
    render(<App />)

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      order: string[]
      cursor: number
    }
    const firstQuestion = questionById.get(saved.order[saved.cursor])!

    fireEvent.click(screen.getByRole('button', { name: firstQuestion.options[firstQuestion.answer] }))

    expect(screen.getByText('理解正确')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /选择词库/ }))
    expect(screen.getByText('正确率 100%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭词库选择' }))
    finishAnimation(document.querySelector('.library-overlay')!)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '关闭词库选择' })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /下一题/ }))
    finishAnimation(document.querySelector('.question-content')!)

    await waitFor(() => {
      expect(screen.queryByText(firstQuestion.english)).not.toBeInTheDocument()
      expect(screen.queryByText('理解正确')).not.toBeInTheDocument()
    })
  })

  it('keeps WASD on the options and maps A to the second option', () => {
    render(<App />)

    const secondOption = questionById.get(questionIds[0])!.options[1]
    fireEvent.keyDown(window, { key: 'a' })

    expect(screen.queryByText('WASD')).not.toBeInTheDocument()
    expect(screen.queryByText('ABCD')).not.toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 W')).toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 A')).toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 S')).toBeInTheDocument()
    expect(screen.getByLabelText('快捷键 D')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: secondOption })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('理解正确')).toBeInTheDocument()
  })

  it('applies the answer feedback motion classes in the intended sequence', () => {
    render(<App />)

    const firstQuestion = questionById.get(questionIds[0])!
    const wrongIndex = (firstQuestion.answer + 1) % firstQuestion.options.length
    const selectedButton = screen.getByRole('button', { name: firstQuestion.options[wrongIndex] })
    const correctButton = screen.getByRole('button', { name: firstQuestion.options[firstQuestion.answer] })

    fireEvent.click(selectedButton)

    expect(selectedButton).toHaveClass('option-selected', 'option-wrong')
    expect(correctButton).toHaveClass('option-correct', 'option-delayed-correct')
    expect(document.querySelector('.feedback-inner')).toBeInTheDocument()
  })

  it('opens the book chooser on demand, switches level, and closes it', async () => {
    render(<App />)

    expect(screen.queryByRole('radio', { name: '挑战词库，16题' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /选择词库/ }))
    const challengeBook = screen.getByRole('radio', { name: '挑战词库，16题' })
    fireEvent.click(challengeBook)
    finishAnimation(challengeBook)
    finishAnimation(document.querySelector('.library-overlay')!)

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
        order: string[]
        answered: number
        correct: number
      }

      expect(saved.order).toHaveLength(16)
      expect(saved.order.every((id) => questionById.get(id)?.level === '挑战')).toBe(true)
      expect(saved.answered).toBe(0)
      expect(saved.correct).toBe(0)
      expect(window.localStorage.getItem(TRAINING_LEVEL_STORAGE_KEY)).toBe('挑战')
      expect(screen.getByText('1 / 5')).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: '挑战词库，16题' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /当前词库：挑战册/ })).toBeInTheDocument()
    })
  })

  it('cancels a pending level switch when the chooser is closed', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /选择词库/ }))
    const challengeBook = screen.getByRole('radio', { name: '挑战词库，16题' })
    fireEvent.click(challengeBook)
    fireEvent.click(screen.getByRole('button', { name: '关闭词库选择' }))
    finishAnimation(challengeBook)
    finishAnimation(document.querySelector('.library-overlay')!)

    expect(screen.queryByRole('radio', { name: '挑战词库，16题' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /当前词库：混合卷/ })).toBeInTheDocument()
    expect(window.localStorage.getItem(TRAINING_LEVEL_STORAGE_KEY)).toBe('全部')
  })

  it('does not advance again when progress is reset during a question exit', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)

    const firstQuestion = questionById.get(questionIds[0])!
    fireEvent.click(screen.getByRole('button', { name: firstQuestion.options[firstQuestion.answer] }))
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }))
    fireEvent.click(screen.getByRole('button', { name: /选择词库/ }))
    fireEvent.click(screen.getByRole('button', { name: '重新开始' }))

    expect(screen.getByRole('article', { name: '英文理解选择题' })).toHaveAttribute('aria-busy', 'false')
    finishAnimation(document.querySelector('.question-content')!)
    expect(screen.getByText('1 / 5')).toBeInTheDocument()

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      cursor: number
      answered: number
    }
    expect(saved.cursor).toBe(0)
    expect(saved.answered).toBe(0)
  })

  it('reveals one vocabulary item and then all remaining items', () => {
    render(<App />)

    expect(screen.queryByText('阅读辅助')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '提示一个' })).not.toBeInTheDocument()
    expect(screen.queryByText('be attributed to')).not.toBeInTheDocument()
    expect(screen.queryByText('solely')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /打开生词提示/ }))
    fireEvent.click(screen.getByRole('button', { name: '提示一个' }))

    expect(screen.getByText('be attributed to')).toBeInTheDocument()
    expect(screen.queryByText('solely')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '全部提示' }))

    expect(screen.getByText('solely')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '提示一个' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '全部提示' })).toBeDisabled()
  })

  it('staggers only the newly revealed vocabulary batch', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /打开生词提示/ }))
    fireEvent.click(screen.getByRole('button', { name: '全部提示' }))

    const items = document.querySelectorAll<HTMLElement>('.vocabulary-list > li')
    expect(items).toHaveLength(2)
    expect(items[0].style.animationDelay).toBe('0ms')
    expect(items[1].style.animationDelay).toBe('50ms')
  })

  it('skips transition delays when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))

    render(<App />)

    const firstQuestion = questionById.get(questionIds[0])!
    fireEvent.click(screen.getByRole('button', { name: firstQuestion.options[firstQuestion.answer] }))
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }))
    expect(screen.queryByText(firstQuestion.english)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /选择词库/ }))
    fireEvent.click(screen.getByRole('radio', { name: '挑战词库，16题' }))
    expect(screen.queryByRole('radio', { name: '挑战词库，16题' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /当前词库：挑战册/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /打开生词提示/ }))
    fireEvent.click(screen.getByRole('button', { name: '全部提示' }))
    document.querySelectorAll<HTMLElement>('.vocabulary-list > li').forEach((item) => {
      expect(item.style.animationDelay).toBe('0ms')
    })
  })

  it('loads an online definition only after the user asks for it', async () => {
    const fetcher = vi.fn((input: string) => {
      if (input.includes('api.dictionaryapi.dev')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{
            word: 'attributed',
            phonetic: '/əˈtrɪbjuːtɪd/',
            phonetics: [],
            meanings: [{
              partOfSpeech: 'verb',
              definitions: [{ definition: 'Regarded as being caused by something.' }],
            }],
            license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
            sourceUrls: ['https://en.wiktionary.org/wiki/attributed'],
          }],
        })
      }

      return new Promise(() => undefined)
    })
    vi.stubGlobal('fetch', fetcher)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /打开生词提示/ }))
    fireEvent.click(screen.getByRole('button', { name: '提示一个' }))

    expect(screen.queryByText('Regarded as being caused by something.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查询 attributed 的在线词典' }))

    expect(await screen.findByText('Regarded as being caused by something.')).toBeInTheDocument()
    expect(screen.getByText(/在线词典/)).toBeInTheDocument()
  })

  it('loads a validated online question bank', async () => {
    window.localStorage.setItem(TRAINING_LEVEL_STORAGE_KEY, '挑战')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => onlineQuestionBank,
    }))

    render(<App />)

    expect(await screen.findByText('Online questions can update without rebuilding the website.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /选择词库/ }))
    expect(screen.getByText('在线题库')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '全部词库，1题' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '挑战词库，0题' })).toBeDisabled()
  })

  it('uses the latest online bank when a pending level animation completes', async () => {
    let resolveFetch!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveFetch = resolve
    })))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /选择词库/ }))
    const challengeBook = screen.getByRole('radio', { name: '挑战词库，16题' })
    fireEvent.click(challengeBook)

    resolveFetch({ ok: true, json: async () => onlineQuestionBank })
    expect(await screen.findByText(onlineQuestionBank.questions[0].english)).toBeInTheDocument()

    finishAnimation(challengeBook)
    finishAnimation(document.querySelector('.library-overlay')!)

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as { order: string[] }
    expect(saved.order).toEqual(['online-1'])
    expect(screen.getByRole('button', { name: /当前词库：混合卷/ })).toBeInTheDocument()
  })

  it('advances with the latest online bank after a question exit animation', async () => {
    let resolveFetch!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveFetch = resolve
    })))

    render(<App />)
    const firstQuestion = questionById.get(questionIds[0])!
    fireEvent.click(screen.getByRole('button', { name: firstQuestion.options[firstQuestion.answer] }))
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }))

    resolveFetch({ ok: true, json: async () => onlineQuestionBank })
    expect(await screen.findByText(onlineQuestionBank.questions[0].english)).toBeInTheDocument()

    finishAnimation(document.querySelector('.question-content')!)

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as { order: string[] }
    expect(saved.order).toEqual(['online-1'])
    expect(screen.getByText(onlineQuestionBank.questions[0].english)).toBeInTheDocument()
  })
})
