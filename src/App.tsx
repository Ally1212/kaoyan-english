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
  const [libraryClosing, setLibraryClosing] = useState(false)
  const [pendingTrainingLevel, setPendingTrainingLevel] = useState<TrainingLevel | null>(null)
  const [libraryTitleConfirming, setLibraryTitleConfirming] = useState(false)
  const [questionExiting, setQuestionExiting] = useState(false)
  const [vocabularyPanelOpen, setVocabularyPanelOpen] = useState(false)
  const [revealedVocabularyCount, setRevealedVocabularyCount] = useState(0)
  const [vocabularyRevealBatch, setVocabularyRevealBatch] = useState({ start: 0, stagger: false })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  ))
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
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)

    setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const applyTrainingLevel = useCallback((level: TrainingLevel) => {
    if (level === activeTrainingLevel) return

    const nextIds = getQuestionIdsForLevel(questionBank.questions, level)
    if (nextIds.length === 0) return

    setTrainingLevel(level)
    setQuestionExiting(false)
    setVocabularyPanelOpen(false)
    setRevealedVocabularyCount(0)
    setVocabularyRevealBatch({ start: 0, stagger: false })
    setProgress(createProgress(nextIds))

    if (prefersReducedMotion) return

    setLibraryTitleConfirming(true)
  }, [activeTrainingLevel, prefersReducedMotion, questionBank.questions])

  const finishLibraryClose = useCallback((level: TrainingLevel | null) => {
    setLibraryOpen(false)
    setLibraryClosing(false)
    setPendingTrainingLevel(null)
    if (level !== null) applyTrainingLevel(level)
    libraryTriggerRef.current?.focus()
  }, [applyTrainingLevel])

  const closeLibrary = useCallback(() => {
    if (!libraryOpen || libraryClosing) return

    if (prefersReducedMotion) {
      finishLibraryClose(null)
      return
    }

    setPendingTrainingLevel(null)
    setLibraryClosing(true)
  }, [finishLibraryClose, libraryClosing, libraryOpen, prefersReducedMotion])

  useEffect(() => {
    if (!libraryOpen) return

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closeLibrary()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [closeLibrary, libraryOpen])

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
    setVocabularyPanelOpen(false)
    setRevealedVocabularyCount(0)
    setVocabularyRevealBatch({ start: 0, stagger: false })
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

  const commitNextQuestion = useCallback(() => {
    setVocabularyPanelOpen(false)
    setRevealedVocabularyCount(0)
    setVocabularyRevealBatch({ start: 0, stagger: false })
    setProgress((current) => advanceProgress(
      current,
      questionIds,
      Math.random,
      SESSION_QUESTION_COUNT,
    ))
  }, [questionIds])

  const nextQuestion = useCallback(() => {
    if (questionExiting) return

    setVocabularyPanelOpen(false)

    if (prefersReducedMotion) {
      commitNextQuestion()
      return
    }

    setQuestionExiting(true)
  }, [commitNextQuestion, prefersReducedMotion, questionExiting])

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
    setLibraryOpen(false)
    setLibraryClosing(false)
    setPendingTrainingLevel(null)
    setQuestionExiting(false)
    setVocabularyPanelOpen(false)
    setRevealedVocabularyCount(0)
    setVocabularyRevealBatch({ start: 0, stagger: false })
    setProgress(createProgress(questionIds))
  }

  const selectTrainingLevel = (level: TrainingLevel) => {
    if (libraryClosing) return
    if (levelCounts[level] === 0) return

    setPendingTrainingLevel(level)

    if (prefersReducedMotion) {
      finishLibraryClose(level)
      return
    }
  }

  const revealNextVocabulary = () => {
    setVocabularyRevealBatch({ start: revealedVocabularyCount, stagger: false })
    setRevealedVocabularyCount((current) => Math.min(current + 1, vocabulary.length))
  }

  const revealAllVocabulary = () => {
    setVocabularyRevealBatch({ start: revealedVocabularyCount, stagger: !prefersReducedMotion })
    setRevealedVocabularyCount(vocabulary.length)
  }

  return (
    <>
      <a className="skip-link" href="#main-content">跳到题目</a>
      <div className="page-shell">
        <main id="main-content">
          <div className="session-line">
            <button
              ref={libraryTriggerRef}
              className="library-trigger"
              type="button"
              aria-expanded={libraryOpen}
              aria-haspopup="dialog"
              aria-label={`当前词库：${levelBookDetails[activeTrainingLevel].title}，${sessionQuestionCount}题，${sessionWordCount}词，选择词库`}
              onClick={() => {
                setLibraryClosing(false)
                setPendingTrainingLevel(null)
                setLibraryOpen(true)
              }}
            >
              <strong
                className={libraryTitleConfirming ? 'library-current-title-confirming' : ''}
                onAnimationEnd={() => setLibraryTitleConfirming(false)}
              >
                {levelBookDetails[activeTrainingLevel].title}
              </strong>
              <span aria-hidden="true">⌄</span>
            </button>
            <span className="session-progress">{progress.cursor + 1} / {sessionQuestionCount}</span>
          </div>

          <article className="question-sheet" aria-label="英文理解选择题" aria-busy={questionExiting}>
            <div
              className={`question-content ${questionExiting ? 'question-content-exiting' : ''}`}
              key={question.id}
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget || !questionExiting) return
                setQuestionExiting(false)
                commitNextQuestion()
              }}
            >
              <section className="reading-column" aria-label="英文题目">
                <p className="english-text" lang="en">{question.english}</p>
              </section>

              <aside
                className={`vocabulary-panel ${vocabularyPanelOpen ? 'vocabulary-panel-open' : ''}`}
                aria-label="生词提示"
              >
                <button
                  className="vocabulary-tab"
                  type="button"
                  aria-expanded={vocabularyPanelOpen}
                  aria-controls="vocabulary-drawer"
                  aria-label={`${vocabularyPanelOpen ? '收起' : '打开'}生词提示，已显示 ${visibleVocabulary.length} 个，共 ${vocabulary.length} 个`}
                  onClick={() => setVocabularyPanelOpen((open) => !open)}
                >
                  <span>词</span>
                  <span className="vocabulary-count" key={visibleVocabulary.length}>
                    {visibleVocabulary.length}/{vocabulary.length}
                  </span>
                  <span aria-hidden="true">{vocabularyPanelOpen ? '→' : '←'}</span>
                </button>

                {vocabularyPanelOpen && (
                  <div className="vocabulary-drawer" id="vocabulary-drawer">
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

                    <div
                      className="vocabulary-reveal"
                      data-open={visibleVocabulary.length > 0}
                      aria-live="polite"
                    >
                      <div className="vocabulary-reveal-inner">
                        <ol className="vocabulary-list">
                          {visibleVocabulary.map((item, index) => (
                            <li
                              key={item.term}
                              style={{
                                animationDelay: vocabularyRevealBatch.stagger && index >= vocabularyRevealBatch.start
                                  ? `${(index - vocabularyRevealBatch.start) * 50}ms`
                                  : '0ms',
                              }}
                            >
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
                  </div>
                )}
              </aside>

              <section className="answer-column">
                <div className="options" aria-label="中文选项">
                  {question.options.map((option, index) => (
                    <button
                      className={[
                        'option',
                        `option-${optionStates[index]}`,
                        progress.selectedIndex === index ? 'option-selected' : '',
                        hasAnswered && !isCorrect && index === question.answer ? 'option-delayed-correct' : '',
                      ].filter(Boolean).join(' ')}
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
                    <div className="feedback-inner">
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
                      <button className="next-button" type="button" onClick={nextQuestion} disabled={questionExiting}>
                        下一题 <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </article>
        </main>

        {libraryOpen && (
          <div
            className={`library-overlay ${libraryClosing ? 'library-closing' : ''}`}
            onAnimationEnd={(event) => {
              if (
                event.target !== event.currentTarget
                || !libraryClosing
              ) return
              finishLibraryClose(pendingTrainingLevel)
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return
              closeLibrary()
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
                  onClick={closeLibrary}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <div className="book-shelf" role="radiogroup" aria-label="选择训练词库">
                {trainingLevels.map((level) => {
                  const count = levelCounts[level]
                  const isActive = (pendingTrainingLevel ?? activeTrainingLevel) === level
                  const isConfirming = pendingTrainingLevel === level
                  const detail = levelBookDetails[level]

                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={`${level}词库，${count}题`}
                      className={[
                        'book-button',
                        `book-${level}`,
                        isActive ? 'book-active' : '',
                        isConfirming ? 'book-confirming' : '',
                      ].filter(Boolean).join(' ')}
                      disabled={count === 0}
                      onClick={() => selectTrainingLevel(level)}
                      onAnimationEnd={(event) => {
                        if (
                          event.target !== event.currentTarget
                          || pendingTrainingLevel !== level
                        ) return
                        setLibraryClosing(true)
                      }}
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

              <div className="library-dialog-footer">
                <p>
                  <span className={`bank-status bank-status-${questionBankSource}`}>
                    {questionBankLabels[questionBankSource]}
                  </span>
                  <span>已答 {progress.answered}</span>
                  <span>正确率 {accuracy}%</span>
                </p>
                <button type="button" onClick={resetProgress}>重新开始</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  )
}

export default App
