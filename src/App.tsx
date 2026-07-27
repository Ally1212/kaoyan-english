import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getOptionIndexForKey, keyBindings } from './lib/keyboard'
import {
  createLocalQuestionBank,
  loadQuestionBank,
  type QuestionBankSource,
} from './lib/questionBank'
import { advanceProgress, createProgress, normalizeProgress, type QuizProgress } from './lib/quiz'
import { clearProgress, loadProgress, saveProgress } from './lib/storage'
import {
  getQuestionIdsForLevel,
  loadTrainingLevel,
  saveTrainingLevel,
  trainingLevels,
  type TrainingLevel,
} from './lib/trainingLevel'
import {
  SESSION_QUESTION_COUNT,
  SESSION_WORD_COUNT,
  createSessionVocabularyLimits,
  getSessionQuestionCount,
} from './lib/trainingSession'
import VocabularyLookup from './VocabularyLookup'

const bundledQuestionBank = createLocalQuestionBank()

const levelBookDetails: Record<TrainingLevel, { title: string; subtitle: string }> = {
  全部: { title: '混合卷', subtitle: '综合理解' },
  基础: { title: '基础册', subtitle: '读准主干' },
  进阶: { title: '进阶册', subtitle: '看懂结构' },
  挑战: { title: '挑战册', subtitle: '复杂推断' },
}

const questionBankLabels: Record<QuestionBankSource | 'loading', string> = {
  loading: '更新题库',
  online: '在线题库',
  cache: '缓存题库',
  local: '本地题库',
}

function fitProgressToSession(progress: QuizProgress): QuizProgress {
  const questionCount = getSessionQuestionCount(progress.order)
  return {
    ...progress,
    cursor: Math.min(progress.cursor, Math.max(0, questionCount - 1)),
  }
}

function App() {
  const [questionBank, setQuestionBank] = useState(bundledQuestionBank)
  const [questionBankSource, setQuestionBankSource] = useState<QuestionBankSource | 'loading'>('loading')
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>(() => loadTrainingLevel())
  const [progress, setProgress] = useState<QuizProgress>(() => fitProgressToSession(loadProgress(
    getQuestionIdsForLevel(bundledQuestionBank.questions, trainingLevel),
  )))
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [revealedVocabularyCount, setRevealedVocabularyCount] = useState(0)
  const libraryTriggerRef = useRef<HTMLButtonElement>(null)
  const { questionById, vocabularyByQuestionId } = questionBank
  const selectedQuestionIds = useMemo(
    () => getQuestionIdsForLevel(questionBank.questions, trainingLevel),
    [questionBank.questions, trainingLevel],
  )
  const activeTrainingLevel = selectedQuestionIds.length > 0 ? trainingLevel : '全部'
  const questionIds = selectedQuestionIds.length > 0 ? selectedQuestionIds : questionBank.questionIds
  const levelCounts: Record<TrainingLevel, number> = {
    全部: questionBank.questions.length,
    基础: getQuestionIdsForLevel(questionBank.questions, '基础').length,
    进阶: getQuestionIdsForLevel(questionBank.questions, '进阶').length,
    挑战: getQuestionIdsForLevel(questionBank.questions, '挑战').length,
  }
  const sessionQuestionCount = getSessionQuestionCount(questionIds)
  const sessionVocabularyLimits = useMemo(
    () => createSessionVocabularyLimits(progress.order, vocabularyByQuestionId),
    [progress.order, vocabularyByQuestionId],
  )
  const sessionWordCount = progress.order
    .slice(0, sessionQuestionCount)
    .reduce((sum, id) => sum + (sessionVocabularyLimits[id] ?? 0), 0)
  const question = questionById.get(progress.order[progress.cursor]) ?? questionById.get(questionIds[0])!
  const vocabulary = (vocabularyByQuestionId[question.id] ?? [])
    .slice(0, sessionVocabularyLimits[question.id] ?? SESSION_WORD_COUNT)
  const visibleVocabulary = vocabulary.slice(0, revealedVocabularyCount)
  const allVocabularyRevealed = revealedVocabularyCount >= vocabulary.length
  const activeKeys = keyBindings
  const hasAnswered = progress.selectedIndex !== null
  const isCorrect = progress.selectedIndex === question.answer
  const accuracy = progress.answered === 0
    ? 0
    : Math.round((progress.correct / progress.answered) * 100)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    saveTrainingLevel(trainingLevel)
  }, [trainingLevel])

  useEffect(() => {
    if (!libraryOpen) return

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setLibraryOpen(false)
      libraryTriggerRef.current?.focus()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [libraryOpen])

  useEffect(() => {
    let cancelled = false

    void loadQuestionBank().then((loadedBank) => {
      if (cancelled) return

      setQuestionBank(loadedBank)
      setQuestionBankSource(loadedBank.source)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const matchingIds = getQuestionIdsForLevel(questionBank.questions, trainingLevel)
    const nextLevel = matchingIds.length > 0 ? trainingLevel : '全部'
    const nextIds = nextLevel === '全部' ? questionBank.questionIds : matchingIds

    if (nextLevel !== trainingLevel) setTrainingLevel(nextLevel)
    setRevealedVocabularyCount(0)
    setProgress((current) => fitProgressToSession({
      ...normalizeProgress(current, nextIds),
      selectedIndex: null,
    }))
  }, [questionBank])

  const chooseOption = useCallback((index: number) => {
    setProgress((current) => {
      if (current.selectedIndex !== null) return current

      return {
        ...current,
        selectedIndex: index,
        answered: current.answered + 1,
        correct: current.correct + (index === question.answer ? 1 : 0),
      }
    })
  }, [question.answer])

  const nextQuestion = useCallback(() => {
    setRevealedVocabularyCount(0)
    setProgress((current) => advanceProgress(
      current,
      questionIds,
      Math.random,
      SESSION_QUESTION_COUNT,
    ))
  }, [questionIds])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (libraryOpen) return

      const optionIndex = getOptionIndexForKey(event.key)

      if (!hasAnswered && optionIndex >= 0) {
        chooseOption(optionIndex)
      } else if (hasAnswered && event.key === 'Enter') {
        nextQuestion()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseOption, hasAnswered, libraryOpen, nextQuestion])

  const optionStates = useMemo(() => question.options.map((_, index) => {
    if (!hasAnswered) return 'idle'
    if (index === question.answer) return 'correct'
    if (index === progress.selectedIndex) return 'wrong'
    return 'muted'
  }), [hasAnswered, progress.selectedIndex, question.answer, question.options])

  const resetProgress = () => {
    if (!window.confirm('确认清空当前答题记录并重新开始吗？')) return

    clearProgress()
    setRevealedVocabularyCount(0)
    setProgress(createProgress(questionIds))
  }

  const selectTrainingLevel = (level: TrainingLevel) => {
    setLibraryOpen(false)
    libraryTriggerRef.current?.focus()
    if (level === activeTrainingLevel) return

    const nextIds = getQuestionIdsForLevel(questionBank.questions, level)
    if (nextIds.length === 0) return

    setTrainingLevel(level)
    setRevealedVocabularyCount(0)
    setProgress(createProgress(nextIds))
  }

  const revealNextVocabulary = () => {
    setRevealedVocabularyCount((current) => Math.min(current + 1, vocabulary.length))
  }

  const revealAllVocabulary = () => {
    setRevealedVocabularyCount(vocabulary.length)
  }

  return (
    <>
      <a className="skip-link" href="#main-content">跳到题目</a>
      <div className="page-shell">
        <header className="topbar">
          <div className="brand-block">
            <h1>看懂一句</h1>
          </div>

          <p className="key-guide" aria-label="使用 WASD 键作答">WASD</p>
        </header>

        <main id="main-content">
          <section className="library-control" aria-label="当前训练词库">
            <button
              ref={libraryTriggerRef}
              className="library-trigger"
              type="button"
              aria-expanded={libraryOpen}
              aria-haspopup="dialog"
              aria-label={`当前词库：${levelBookDetails[activeTrainingLevel].title}，${sessionQuestionCount}题，${sessionWordCount}词，选择词库`}
              onClick={() => setLibraryOpen(true)}
            >
              <span>
                <small>当前词库</small>
                <strong>{levelBookDetails[activeTrainingLevel].title}</strong>
              </span>
              <span className="library-trigger-meta">
                每轮 {sessionQuestionCount} 题 · {sessionWordCount} 词
              </span>
              <span className="library-trigger-action">选择词库 <i aria-hidden="true">↗</i></span>
            </button>
          </section>

          <article className="question-sheet" aria-labelledby="question-prompt">
            <div className="question-content" key={question.id}>
              <section className="reading-column" aria-label="英文题目">
                <div className="question-meta">
                  <span>{progress.cursor + 1} / {sessionQuestionCount}</span>
                  <span aria-hidden="true">·</span>
                  <span>{question.level}</span>
                  <span aria-hidden="true">·</span>
                  <span>{question.tag}</span>
                </div>

                <p className="english-text" lang="en">{question.english}</p>
              </section>

              <aside className="vocabulary-panel" aria-labelledby="vocabulary-heading">
                <div className="vocabulary-toolbar">
                  <div>
                    <p className="eyebrow">阅读辅助</p>
                    <h2 id="vocabulary-heading">生词提示</h2>
                    <span>{visibleVocabulary.length} / {vocabulary.length}</span>
                  </div>

                  <div className="vocabulary-actions">
                    <button
                      type="button"
                      onClick={revealNextVocabulary}
                      disabled={allVocabularyRevealed}
                    >
                      提示一个
                    </button>
                    <button
                      type="button"
                      onClick={revealAllVocabulary}
                      disabled={allVocabularyRevealed}
                    >
                      全部提示
                    </button>
                  </div>
                </div>

                <div
                  className="vocabulary-reveal"
                  data-open={visibleVocabulary.length > 0}
                  aria-live="polite"
                >
                  <div className="vocabulary-reveal-inner">
                    <ol className="vocabulary-list">
                      {visibleVocabulary.map((item) => (
                        <li key={item.term}>
                          <p className="vocabulary-term-line">
                            <strong lang="en">{item.term}</strong>
                            <span>{item.meaning}</span>
                          </p>
                          <p className="vocabulary-breakdown">{item.breakdown}</p>
                          <VocabularyLookup term={item.term} />
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </aside>

              <section className="answer-column">
                <h2 id="question-prompt">选择最准确的理解</h2>

                <div className="options" aria-label="中文选项">
                  {question.options.map((option, index) => (
                    <button
                      className={`option option-${optionStates[index]}`}
                      type="button"
                      key={`${question.id}-${index}`}
                      onClick={() => chooseOption(index)}
                      disabled={hasAnswered}
                      aria-pressed={progress.selectedIndex === index}
                      aria-label={option}
                    >
                      <span lang="zh-CN">{option}</span>
                      <kbd className="option-key" aria-label={`快捷键 ${activeKeys[index]}`}>{activeKeys[index]}</kbd>
                    </button>
                  ))}
                </div>

                <div className={`feedback ${hasAnswered ? 'feedback-visible' : ''}`} aria-live="polite">
                  {hasAnswered && (
                    <>
                      <div className="feedback-heading">
                        <span className={`result-mark ${isCorrect ? 'result-correct' : 'result-wrong'}`} aria-hidden="true">
                          {isCorrect ? '✓' : '×'}
                        </span>
                        <div>
                          <p className="result-title">{isCorrect ? '理解正确' : '这处容易误读'}</p>
                          {!isCorrect && <p className="correct-answer">正确理解已标出</p>}
                        </div>
                      </div>

                      <p className="explanation" lang="zh-CN">{question.explanation}</p>
                      <button className="next-button" type="button" onClick={nextQuestion}>
                        下一题 <span aria-hidden="true">→</span>
                      </button>
                    </>
                  )}
                </div>
              </section>
            </div>
          </article>

          <p className="keyboard-hint">
            {activeKeys.join(' · ')} 作答，Enter 下一题
          </p>
        </main>

        {libraryOpen && (
          <div
            className="library-overlay"
            onClick={(event) => {
              if (event.target !== event.currentTarget) return
              setLibraryOpen(false)
              libraryTriggerRef.current?.focus()
            }}
          >
            <section
              className="library-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="library-dialog-heading"
            >
              <div className="library-dialog-heading">
                <div>
                  <p className="eyebrow">训练书架</p>
                  <h2 id="library-dialog-heading">选择一本词库</h2>
                </div>
                <button
                  type="button"
                  aria-label="关闭词库选择"
                  autoFocus
                  onClick={() => {
                    setLibraryOpen(false)
                    libraryTriggerRef.current?.focus()
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <div className="book-shelf" role="radiogroup" aria-label="选择训练词库">
                {trainingLevels.map((level) => {
                  const count = levelCounts[level]
                  const isActive = activeTrainingLevel === level
                  const detail = levelBookDetails[level]

                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={`${level}词库，${count}题`}
                      className={`book-button book-${level} ${isActive ? 'book-active' : ''}`}
                      disabled={count === 0}
                      onClick={() => selectTrainingLevel(level)}
                      key={level}
                    >
                      <span className="book-spine" aria-hidden="true" />
                      <span className="book-cover">
                        <small>考研英语</small>
                        <strong>{detail.title}</strong>
                        <span>{detail.subtitle}</span>
                        <i>{count} 题 · 每轮 10 词</i>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        <footer>
          <span>已答 {progress.answered}</span>
          <span aria-hidden="true">·</span>
          <span>正确率 {accuracy}%</span>
          <span aria-hidden="true">·</span>
          <span
            className={`bank-status bank-status-${questionBankSource}`}
            aria-live="polite"
          >
            {questionBankLabels[questionBankSource]}
          </span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={resetProgress}>重新开始</button>
        </footer>
      </div>
    </>
  )
}

export default App
