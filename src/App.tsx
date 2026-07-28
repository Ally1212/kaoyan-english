import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import VocabularyLookup from './VocabularyLookup'
import { getOptionIndexForKey, keyBindings } from './lib/keyboard'
import {
  clearMistakes,
  buildReviewQueue,
  loadMistakes,
  recordMistake,
  saveMistakes,
  applyReviewResult,
  type MistakeRecord,
  type ReviewQueueItem,
  type TrainingMode,
} from './lib/mistakes'
import {
  clearQuestionFeedback,
  loadQuestionFeedback,
  saveQuestionFeedback,
  toggleQuestionFeedback,
  type QuestionFeedbackRecord,
} from './lib/questionFeedback'
import {
  createLocalQuestionBank,
  createLocalSentenceBank,
  loadQuestionBank,
  loadSentenceBank,
  mergeQuestionBanks,
  type QuestionBank,
  type QuestionBankSource,
} from './lib/questionBank'
import {
  advanceProgress,
  createProgress,
  createReadingQuestion,
  normalizeProgress,
  type QuizProgress,
} from './lib/quiz'
import { clearProgress, readProgress, saveProgress } from './lib/storage'
import {
  defaultTrainingPreferences,
  loadTrainingPreferences,
  saveTrainingPreferences,
  type TrainingPreferences,
} from './lib/trainingPreferences'
import { getQuestionIdsForExamLevel, trainingLevels, type TrainingLevel } from './lib/trainingLevel'
import {
  SESSION_QUESTION_COUNT,
  SESSION_WORD_COUNT,
  createSessionVocabularyLimits,
  getSessionQuestionCount,
} from './lib/trainingSession'
import {
  createLocalVocabularyBank,
  examLibraries,
  getWordsForExam,
  loadVocabularyBank,
  mergeVocabularyBanks,
  type ExamLibrary,
  type VocabularyBankSource,
  type VocabularyWord,
} from './lib/vocabularyBank'
import { createVocabularyQuestion, type QuestionPass } from './lib/vocabularyQuiz'

const bundledQuestionBank = createLocalQuestionBank()
const bundledSentenceBank = createLocalSentenceBank()
const bundledVocabularyBank = createLocalVocabularyBank()
const thirdPartyNoticeUrl = `${import.meta.env.BASE_URL || './'}third-party-notices.md`

const examDetails: Record<ExamLibrary, { title: string; subtitle: string }> = {
  cet4: { title: '四级', subtitle: '大学英语基础' },
  cet6: { title: '六级', subtitle: '进阶综合能力' },
  ky: { title: '考研', subtitle: '阅读与词汇' },
  ielts: { title: '雅思', subtitle: '学术英语参考' },
  toefl: { title: '托福', subtitle: '学术词汇参考' },
}

const modeDetails: Record<TrainingMode, { title: string; description: string }> = {
  'word-zh': { title: '单词认义', description: '英文单词选择中文核心含义' },
  'word-en': { title: '英文释义', description: '直接使用英文理解英文' },
  reading: { title: '句意理解', description: '阅读英文并选择准确的中文理解' },
}

const bankLabels: Record<QuestionBankSource | VocabularyBankSource | 'loading', string> = {
  loading: '正在更新',
  online: '在线词库',
  cache: '缓存词库',
  local: '本地保底',
}

type SessionPhase = 'practice' | 'review-intro' | 'review' | 'review-result'

interface ActiveQuestion {
  id: string
  prompt: string
  promptMeta: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  explanation: string
  lookupTerm: string | null
  vocabulary: Array<{ term: string; meaning: string; breakdown: string }>
  source: {
    name: string
    url: string
    license: string
    licenseUrl: string
    attribution: string
    adaptation: string
  } | null
}

interface RoundMistake extends ReviewQueueItem {
  reviewCorrect?: boolean
}

function getIdsForPreferences(
  preferences: TrainingPreferences,
  questionBank: ReturnType<typeof createLocalQuestionBank>,
  vocabularyWords: readonly VocabularyWord[],
): string[] {
  if (preferences.mode === 'reading') {
    return getQuestionIdsForExamLevel(questionBank.questions, preferences.exam, preferences.level)
  }
  return getWordsForExam(vocabularyWords, preferences.exam).map((word) => word.id)
}

function fitProgressToSession(progress: QuizProgress): QuizProgress {
  const questionCount = getSessionQuestionCount(progress.order)
  return {
    ...progress,
    cursor: Math.min(progress.cursor, Math.max(0, questionCount - 1)),
  }
}

function createTrainingWeight(
  preferences: TrainingPreferences,
  questionBank: QuestionBank,
  mistakes: readonly MistakeRecord[],
  questionFeedback: readonly QuestionFeedbackRecord[],
): (id: string) => number {
  const mistakeByItemId = new Map(
    mistakes
      .filter((record) => record.exam === preferences.exam && record.mode === preferences.mode)
      .map((record) => [record.itemId, record]),
  )
  const reportedIds = new Set(questionFeedback.map((record) => record.questionId))

  return (id: string) => {
    const qualityWeight = preferences.mode === 'reading'
      ? 0.7 + ((questionBank.questionById.get(id)?.qualityScore ?? 100) / 100) * 1.3
      : 1
    const mistakeWeight = 1 + Math.min(mistakeByItemId.get(id)?.wrongCount ?? 0, 4) * 0.12
    const feedbackWeight = preferences.mode === 'reading' && reportedIds.has(id) ? 0.05 : 1
    return qualityWeight * mistakeWeight * feedbackWeight
  }
}

function formatNextReview(record: MistakeRecord): string {
  if (record.status === '已掌握') return '已掌握'

  const now = new Date()
  const target = new Date(record.nextReviewAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const dayDifference = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000)

  if (dayDifference <= 0) return '今日到期'
  if (dayDifference === 1) return '明日复习'
  return `${target.getMonth() + 1}月${target.getDate()}日复习`
}

function createInitialProgress(
  preferences: TrainingPreferences,
  savedProgress: unknown,
): QuizProgress {
  const ids = getIdsForPreferences(
    preferences,
    mergeQuestionBanks(bundledQuestionBank, bundledSentenceBank),
    bundledVocabularyBank.words,
  )
  return fitProgressToSession(normalizeProgress(savedProgress, ids))
}

function App() {
  const [coreQuestionBank, setCoreQuestionBank] = useState(bundledQuestionBank)
  const [sentenceBank, setSentenceBank] = useState(bundledSentenceBank)
  const [vocabularyBank, setVocabularyBank] = useState(bundledVocabularyBank)
  const [questionBankSource, setQuestionBankSource] = useState<QuestionBankSource | 'loading'>('loading')
  const [sentenceBankSource, setSentenceBankSource] = useState<QuestionBankSource | 'loading'>('loading')
  const [vocabularyBankSource, setVocabularyBankSource] = useState<VocabularyBankSource | 'loading'>('loading')
  const [preferences, setPreferences] = useState<TrainingPreferences>(() => loadTrainingPreferences())
  const [draftPreferences, setDraftPreferences] = useState<TrainingPreferences>(defaultTrainingPreferences)
  const savedProgressRef = useRef<unknown>(readProgress())
  const progressTouchedRef = useRef(false)
  const [progress, setProgress] = useState<QuizProgress>(() => (
    createInitialProgress(preferences, savedProgressRef.current)
  ))
  const [progressHydrated, setProgressHydrated] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [mistakeListOpen, setMistakeListOpen] = useState(false)
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(() => loadMistakes())
  const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedbackRecord[]>(() => loadQuestionFeedback())
  const [phase, setPhase] = useState<SessionPhase>('practice')
  const [roundMistakes, setRoundMistakes] = useState<RoundMistake[]>([])
  const [reviewCursor, setReviewCursor] = useState(0)
  const [reviewSelectedIndex, setReviewSelectedIndex] = useState<number | null>(null)
  const [vocabularyPanelOpen, setVocabularyPanelOpen] = useState(false)
  const [revealedVocabularyCount, setRevealedVocabularyCount] = useState(0)
  const libraryTriggerRef = useRef<HTMLButtonElement>(null)
  const libraryDialogRef = useRef<HTMLElement>(null)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const resetDialogRef = useRef<HTMLElement>(null)
  const cancelResetButtonRef = useRef<HTMLButtonElement>(null)

  const questionBank = useMemo(
    () => mergeQuestionBanks(coreQuestionBank, sentenceBank),
    [coreQuestionBank, sentenceBank],
  )

  const selectedWords = useMemo(
    () => getWordsForExam(vocabularyBank.words, preferences.exam),
    [preferences.exam, vocabularyBank.words],
  )
  const activeIds = useMemo(
    () => getIdsForPreferences(preferences, questionBank, vocabularyBank.words),
    [preferences, questionBank, vocabularyBank.words],
  )
  const draftActiveIds = useMemo(
    () => getIdsForPreferences(draftPreferences, questionBank, vocabularyBank.words),
    [draftPreferences, questionBank, vocabularyBank.words],
  )
  const activeTrainingWeight = useMemo(
    () => createTrainingWeight(preferences, questionBank, mistakes, questionFeedback),
    [mistakes, preferences, questionBank, questionFeedback],
  )
  const draftTrainingWeight = useMemo(
    () => createTrainingWeight(draftPreferences, questionBank, mistakes, questionFeedback),
    [draftPreferences, mistakes, questionBank, questionFeedback],
  )
  const sessionQuestionCount = getSessionQuestionCount(activeIds)
  const currentPracticeId = progress.order[progress.cursor] ?? activeIds[0]
  const currentReviewId = roundMistakes[reviewCursor]?.itemId
  const currentId = phase === 'review' ? currentReviewId : currentPracticeId
  const questionPass: QuestionPass = phase === 'review' ? 'review' : 'practice'

  const sessionVocabularyLimits = useMemo(
    () => createSessionVocabularyLimits(progress.order, questionBank.vocabularyByQuestionId),
    [progress.order, questionBank.vocabularyByQuestionId],
  )

  const calculatedQuestion = useMemo<ActiveQuestion>(() => {
    if (preferences.mode !== 'reading') {
      const safeWordId = selectedWords.some((word) => word.id === currentId)
        ? currentId
        : selectedWords[0]?.id
      if (!safeWordId) throw new Error(`No vocabulary available for ${preferences.exam}`)
      const question = createVocabularyQuestion(selectedWords, safeWordId, preferences.mode, questionPass)
      return { ...question, vocabulary: [], source: null }
    }

    const sourceQuestion = questionBank.questionById.get(currentId)
      ?? questionBank.questionById.get(activeIds[0])
      ?? questionBank.questions[0]
    const question = createReadingQuestion(sourceQuestion, questionPass)
    return {
      id: question.id,
      prompt: question.english,
      promptMeta: `${question.kind} · ${question.tag}`,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      lookupTerm: null,
      source: question.source ?? null,
      vocabulary: (questionBank.vocabularyByQuestionId[question.id] ?? [])
        .slice(0, sessionVocabularyLimits[question.id] ?? SESSION_WORD_COUNT),
    }
  }, [activeIds, currentId, preferences.mode, questionBank, questionPass, selectedWords, sessionVocabularyLimits])

  const activeQuestionKey = `${preferences.exam}:${preferences.mode}:${phase}:${currentId ?? 'none'}`
  const activeQuestionSnapshotRef = useRef<{ key: string; question: ActiveQuestion } | null>(null)
  if (activeQuestionSnapshotRef.current?.key !== activeQuestionKey) {
    activeQuestionSnapshotRef.current = { key: activeQuestionKey, question: calculatedQuestion }
  }
  const activeQuestion = activeQuestionSnapshotRef.current.question

  const selectedIndex = phase === 'review' ? reviewSelectedIndex : progress.selectedIndex
  const hasAnswered = selectedIndex !== null
  const isCorrect = selectedIndex === activeQuestion.answer
  const isFinalPracticeQuestion = progress.cursor === sessionQuestionCount - 1
  const visibleVocabulary = activeQuestion.vocabulary.slice(0, revealedVocabularyCount)
  const allVocabularyRevealed = revealedVocabularyCount >= activeQuestion.vocabulary.length
  const accuracy = progress.answered === 0
    ? 0
    : Math.round((progress.correct / progress.answered) * 100)
  const readingBankSource: QuestionBankSource | 'loading' = (
    questionBankSource === 'online' || sentenceBankSource === 'online'
      ? 'online'
      : questionBankSource === 'loading' || sentenceBankSource === 'loading'
        ? 'loading'
        : sentenceBankSource === 'cache' || questionBankSource === 'cache'
          ? 'cache'
          : 'local'
  )
  const activeBankLoading = preferences.mode === 'reading'
    ? questionBankSource === 'loading' || sentenceBankSource === 'loading'
    : vocabularyBankSource === 'loading'
  const currentRoundReviewCount = roundMistakes.filter((item) => item.reviewOrigin === '本轮').length
  const historicalReviewCount = roundMistakes.length - currentRoundReviewCount
  const pendingMistakeCount = mistakes.filter((item) => item.status !== '已掌握').length
  const reviewNow = new Date().toISOString()
  const dueMistakeCount = mistakes.filter((item) => item.status !== '已掌握' && item.nextReviewAt <= reviewNow).length
  const scheduledMistakeCount = pendingMistakeCount - dueMistakeCount
  const currentQuestionReported = questionFeedback.some((record) => record.questionId === activeQuestion.id)

  useEffect(() => {
    if (progressHydrated) saveProgress(progress)
  }, [progress, progressHydrated])
  useEffect(() => saveTrainingPreferences(preferences), [preferences])
  useEffect(() => saveMistakes(mistakes), [mistakes])
  useEffect(() => saveQuestionFeedback(questionFeedback), [questionFeedback])

  useEffect(() => {
    let cancelled = false
    void loadQuestionBank().then((loadedBank) => {
      if (cancelled) return
      setCoreQuestionBank(mergeQuestionBanks(loadedBank, bundledQuestionBank))
      setQuestionBankSource(loadedBank.source)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadSentenceBank().then((loadedBank) => {
      if (cancelled) return
      setSentenceBank(mergeQuestionBanks(loadedBank, bundledSentenceBank))
      setSentenceBankSource(loadedBank.source)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadVocabularyBank().then((loadedBank) => {
      if (cancelled) return
      setVocabularyBank(mergeVocabularyBanks(bundledVocabularyBank, loadedBank))
      setVocabularyBankSource(loadedBank.source)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (activeIds.length === 0 || activeBankLoading) return
    setProgress((current) => fitProgressToSession(normalizeProgress(
      progressHydrated || progressTouchedRef.current ? current : savedProgressRef.current,
      activeIds,
    )))
    if (!progressHydrated) setProgressHydrated(true)
  }, [activeBankLoading, activeIds, progressHydrated])

  const closeLibrary = useCallback(() => {
    setLibraryOpen(false)
    window.setTimeout(() => libraryTriggerRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (!libraryOpen) return
    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (resetConfirmOpen) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLibrary()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = Array.from(
        libraryDialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [],
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)
      if (!firstElement || !lastElement) return

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [closeLibrary, libraryOpen, resetConfirmOpen])

  useEffect(() => {
    if (!resetConfirmOpen) return

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setResetConfirmOpen(false)
        window.setTimeout(() => resetTriggerRef.current?.focus(), 0)
        return
      }

      if (event.key !== 'Tab') return
      const buttons = Array.from(resetDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const firstButton = buttons[0]
      const lastButton = buttons.at(-1)
      if (!firstButton || !lastButton) return

      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault()
        lastButton.focus()
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault()
        firstButton.focus()
      }
    }

    cancelResetButtonRef.current?.focus()
    window.addEventListener('keydown', handleDialogKeyDown)
    return () => window.removeEventListener('keydown', handleDialogKeyDown)
  }, [resetConfirmOpen])

  const resetQuestionExtras = () => {
    setVocabularyPanelOpen(false)
    setRevealedVocabularyCount(0)
  }

  const createRoundAttempt = useCallback((index: number): RoundMistake => ({
    key: `${preferences.mode}:${preferences.exam}:${activeQuestion.id}`,
    itemId: activeQuestion.id,
    exam: preferences.exam,
    mode: preferences.mode,
    prompt: activeQuestion.prompt,
    selectedAnswer: activeQuestion.options[index],
    correctAnswer: activeQuestion.options[activeQuestion.answer],
    explanation: activeQuestion.explanation,
    reviewOrigin: phase === 'review' ? roundMistakes[reviewCursor]?.reviewOrigin ?? '历史' : '本轮',
  }), [activeQuestion, phase, preferences.exam, preferences.mode, reviewCursor, roundMistakes])

  const chooseOption = useCallback((index: number) => {
    if (hasAnswered) return
    progressTouchedRef.current = true

    if (phase === 'review') {
      setReviewSelectedIndex(index)
      const attempt = createRoundAttempt(index)
      const correct = index === activeQuestion.answer
      setRoundMistakes((current) => current.map((item, itemIndex) => (
        itemIndex === reviewCursor ? { ...item, ...attempt, reviewCorrect: correct } : item
      )))
      setMistakes((current) => {
        const withAttempt = correct ? current : recordMistake(current, attempt)
        return applyReviewResult(withAttempt, attempt.key, correct)
      })
      return
    }

    setProgress((current) => ({
      ...current,
      selectedIndex: index,
      answered: current.answered + 1,
      correct: current.correct + (index === activeQuestion.answer ? 1 : 0),
    }))

    if (index !== activeQuestion.answer) {
      const attempt = createRoundAttempt(index)
      setRoundMistakes((current) => (
        current.some((item) => item.key === attempt.key) ? current : [...current, attempt]
      ))
      setMistakes((current) => recordMistake(current, attempt))
    }
  }, [activeQuestion.answer, createRoundAttempt, hasAnswered, phase, reviewCursor])

  const nextQuestion = useCallback(() => {
    if (!hasAnswered) return
    resetQuestionExtras()

    if (phase === 'review') {
      if (reviewCursor < roundMistakes.length - 1) {
        setReviewCursor((current) => current + 1)
        setReviewSelectedIndex(null)
      } else {
        setPhase('review-result')
      }
      return
    }

    if (isFinalPracticeQuestion) {
      setRoundMistakes((current) => buildReviewQueue(
        current,
        mistakes,
        preferences.exam,
        preferences.mode,
        activeIds,
      ))
      setPhase('review-intro')
      return
    }

    setProgress((current) => advanceProgress(
      current,
      activeIds,
      Math.random,
      SESSION_QUESTION_COUNT,
      activeTrainingWeight,
    ))
  }, [activeIds, activeTrainingWeight, hasAnswered, isFinalPracticeQuestion, mistakes, phase, preferences.exam, preferences.mode, reviewCursor, roundMistakes.length])

  const startReview = () => {
    setReviewCursor(0)
    setReviewSelectedIndex(null)
    setPhase('review')
  }

  const startNextRound = () => {
    resetQuestionExtras()
    setRoundMistakes([])
    setReviewCursor(0)
    setReviewSelectedIndex(null)
    setPhase('practice')
    setProgress((current) => advanceProgress(
      current,
      activeIds,
      Math.random,
      SESSION_QUESTION_COUNT,
      activeTrainingWeight,
    ))
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || libraryOpen) return
      const optionIndex = getOptionIndexForKey(event.key)

      if ((phase === 'practice' || phase === 'review') && !hasAnswered && optionIndex >= 0) {
        chooseOption(optionIndex)
      } else if ((phase === 'practice' || phase === 'review') && hasAnswered && event.key === 'Enter') {
        nextQuestion()
      } else if (phase === 'review-intro' && event.key === 'Enter') {
        roundMistakes.length > 0 ? startReview() : startNextRound()
      } else if (phase === 'review-result' && event.key === 'Enter') {
        startNextRound()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseOption, hasAnswered, libraryOpen, nextQuestion, phase, roundMistakes.length])

  const optionStates = activeQuestion.options.map((_, index) => {
    if (!hasAnswered) return 'idle'
    if (index === activeQuestion.answer) return 'correct'
    if (index === selectedIndex) return 'wrong'
    return 'muted'
  })

  const openLibrary = () => {
    setDraftPreferences(preferences)
    setMistakeListOpen(false)
    setLibraryOpen(true)
  }

  const selectDraftExam = (exam: ExamLibrary) => {
    setDraftPreferences((current) => ({
      ...current,
      exam,
    }))
  }

  const applySelection = () => {
    const nextPreferences = draftPreferences
    const nextIds = draftActiveIds
    if (nextIds.length === 0) return

    progressTouchedRef.current = true
    setPreferences(nextPreferences)
    setProgress(createProgress(nextIds, Math.random, draftTrainingWeight))
    setRoundMistakes([])
    setReviewCursor(0)
    setReviewSelectedIndex(null)
    setPhase('practice')
    resetQuestionExtras()
    closeLibrary()
  }

  const closeResetConfirm = () => {
    setResetConfirmOpen(false)
    window.setTimeout(() => resetTriggerRef.current?.focus(), 0)
  }

  const confirmResetAll = () => {
    progressTouchedRef.current = true
    clearProgress()
    clearMistakes()
    clearQuestionFeedback()
    setMistakes([])
    setQuestionFeedback([])
    setProgress(createProgress(
      activeIds,
      Math.random,
      createTrainingWeight(preferences, questionBank, [], []),
    ))
    setRoundMistakes([])
    setPhase('practice')
    setResetConfirmOpen(false)
    setLibraryOpen(false)
    resetQuestionExtras()
    window.setTimeout(() => libraryTriggerRef.current?.focus(), 0)
  }

  const revealNextVocabulary = () => {
    setRevealedVocabularyCount((current) => Math.min(current + 1, activeQuestion.vocabulary.length))
  }

  const toggleCurrentQuestionFeedback = () => {
    setQuestionFeedback((current) => toggleQuestionFeedback(current, activeQuestion.id))
  }

  const getReviewResultLabel = (item: RoundMistake): string => {
    if (!item.reviewCorrect) return '今日到期'
    const record = mistakes.find((mistake) => mistake.key === item.key)
    if (!record) return '已纠正'
    if (record.reviewStage === 1) return '明日复习'
    if (record.reviewStage === 2) return '3 天后复习'
    return '已掌握'
  }

  const currentTitle = `${examDetails[preferences.exam].title}${preferences.mode === 'reading' ? '句库' : '词库'} · ${modeDetails[preferences.mode].title}`
  const draftBankSource = draftPreferences.mode === 'reading' ? readingBankSource : vocabularyBankSource
  const progressLabel = phase === 'review'
    ? `自测 ${reviewCursor + 1} / ${roundMistakes.length}`
    : phase === 'practice'
      ? `${progress.cursor + 1} / ${sessionQuestionCount}`
      : '本轮复盘'

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
              aria-label={`当前训练：${currentTitle}，选择词库和类型`}
              onClick={openLibrary}
            >
              <strong>{currentTitle}</strong>
              <span aria-hidden="true">⌄</span>
            </button>
            <span className="session-progress">{progressLabel}</span>
          </div>

          {(phase === 'review-intro' || phase === 'review-result') ? (
            <article className="review-sheet" aria-live="polite">
              <p className="eyebrow">每 {sessionQuestionCount} 题自动复盘</p>
              <h1>{phase === 'review-intro' ? '阶段自测' : '自测结果'}</h1>

              {phase === 'review-intro' && roundMistakes.length === 0 ? (
                <>
                  <p className="review-lead">{sessionQuestionCount} / {sessionQuestionCount}，本轮没有需要复习的错题。</p>
                  <button className="next-button" type="button" onClick={startNextRound}>继续下一组 →</button>
                </>
              ) : (
                <>
                  <p className="review-lead">
                    {phase === 'review-intro'
                      ? currentRoundReviewCount === 0
                        ? `本轮 ${sessionQuestionCount} / ${sessionQuestionCount}，并加入 ${historicalReviewCount} 道历史待复习题。`
                        : historicalReviewCount > 0
                          ? `本轮错 ${currentRoundReviewCount} 道，另加入 ${historicalReviewCount} 道历史待复习题。`
                          : `本轮错 ${currentRoundReviewCount} 道，立即重新测试这些内容。`
                      : `${roundMistakes.filter((item) => item.reviewCorrect).length} 个已纠正，${roundMistakes.filter((item) => !item.reviewCorrect).length} 个仍需巩固。`}
                  </p>
                  <ol className="review-list">
                    {roundMistakes.map((item) => (
                      <li key={item.key}>
                        <div className="review-item-heading">
                          <strong lang="en">{item.prompt}</strong>
                          <span
                            {...(phase === 'review-result'
                              ? { 'data-correct': item.reviewCorrect ? 'true' : 'false' }
                              : { 'data-origin': item.reviewOrigin })}
                          >
                            {phase === 'review-result'
                              ? getReviewResultLabel(item)
                              : item.reviewOrigin}
                          </span>
                        </div>
                        <p><b>你的选择：</b>{item.selectedAnswer}</p>
                        <p><b>正确答案：</b>{item.correctAnswer}</p>
                        {phase === 'review-result' && <p className="review-explanation">{item.explanation}</p>}
                      </li>
                    ))}
                  </ol>
                  <button
                    className="next-button"
                    type="button"
                    onClick={phase === 'review-intro' ? startReview : startNextRound}
                  >
                    {phase === 'review-intro' ? '开始自测 →' : '继续下一组 →'}
                  </button>
                </>
              )}
            </article>
          ) : (
            <article className="question-sheet" aria-label="英语选择题">
              <div
                className={`question-content ${preferences.mode === 'reading' && phase === 'practice' && activeQuestion.vocabulary.length > 0 ? 'question-content-with-vocabulary' : ''}`}
                key={`${phase}-${activeQuestion.id}`}
              >
                <section className="reading-column" aria-label="英文题目">
                  <p className="question-meta">{phase === 'review' ? '错题自测' : activeQuestion.promptMeta}</p>
                  <p
                    className={`english-text ${preferences.mode !== 'reading' ? 'english-word' : ''}`}
                    lang="en"
                  >
                    {activeQuestion.prompt}
                  </p>
                  {preferences.mode !== 'reading' && <p className="word-meta" lang="en">{activeQuestion.promptMeta}</p>}
                </section>

                {preferences.mode === 'reading' && phase === 'practice' && activeQuestion.vocabulary.length > 0 && (
                  <aside className={`vocabulary-panel ${vocabularyPanelOpen ? 'vocabulary-panel-open' : ''}`} aria-label="生词提示">
                    <button
                      className="vocabulary-tab"
                      type="button"
                      aria-expanded={vocabularyPanelOpen}
                      aria-controls="vocabulary-drawer"
                      aria-label={`${vocabularyPanelOpen ? '收起' : '打开'}生词提示，已显示 ${visibleVocabulary.length} 个，共 ${activeQuestion.vocabulary.length} 个`}
                      onClick={() => setVocabularyPanelOpen((open) => !open)}
                    >
                      <span>词</span>
                      <span className="vocabulary-count">{visibleVocabulary.length}/{activeQuestion.vocabulary.length}</span>
                      <span aria-hidden="true">{vocabularyPanelOpen ? '→' : '←'}</span>
                    </button>

                    {vocabularyPanelOpen && (
                      <div className="vocabulary-drawer" id="vocabulary-drawer">
                        <div className="vocabulary-actions">
                          <button type="button" onClick={revealNextVocabulary} disabled={allVocabularyRevealed}>提示一个</button>
                          <button type="button" onClick={() => setRevealedVocabularyCount(activeQuestion.vocabulary.length)} disabled={allVocabularyRevealed}>全部提示</button>
                        </div>
                        <ol className="vocabulary-list" aria-live="polite">
                          {visibleVocabulary.map((item) => (
                            <li key={item.term}>
                              <p className="vocabulary-term-line"><strong lang="en">{item.term}</strong><span>{item.meaning}</span></p>
                              <p className="vocabulary-breakdown">{item.breakdown}</p>
                              <VocabularyLookup term={item.term} />
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </aside>
                )}

                <section className="answer-column">
                  <div className="options" aria-label="选项">
                    {activeQuestion.options.map((option, index) => (
                      <button
                        className={[
                          'option',
                          `option-${optionStates[index]}`,
                          selectedIndex === index ? 'option-selected' : '',
                          hasAnswered && !isCorrect && index === activeQuestion.answer ? 'option-delayed-correct' : '',
                        ].filter(Boolean).join(' ')}
                        type="button"
                        key={`${activeQuestion.id}-${index}-${questionPass}`}
                        onClick={() => chooseOption(index)}
                        disabled={hasAnswered}
                        aria-pressed={selectedIndex === index}
                        aria-label={option}
                      >
                        <span>{option}</span>
                        <kbd className="option-key" aria-label={`快捷键 ${keyBindings[index]}`}>{keyBindings[index]}</kbd>
                      </button>
                    ))}
                  </div>

                  <div className={`feedback ${hasAnswered ? 'feedback-visible' : ''}`} aria-live="polite">
                    {hasAnswered && (
                      <div className="feedback-inner">
                        <div className="feedback-heading">
                          <span className={`result-mark ${isCorrect ? 'result-correct' : 'result-wrong'}`} aria-hidden="true">{isCorrect ? '✓' : '×'}</span>
                          <div>
                            <p className="result-title">
                              {isCorrect
                                ? preferences.mode === 'reading' ? '理解正确' : '词义正确'
                                : preferences.mode === 'reading' ? '这处容易误读' : '这个词需要再看'}
                            </p>
                            {!isCorrect && <p className="correct-answer">正确答案已标出</p>}
                          </div>
                        </div>
                        <p className="explanation">{activeQuestion.explanation}</p>
                        {activeQuestion.source && (
                          <p className="question-source">
                            来源：<a href={activeQuestion.source.url} target="_blank" rel="noreferrer">
                              {activeQuestion.source.name} · {new URL(activeQuestion.source.url).hostname}
                            </a>
                            <span> · </span>
                            <a href={activeQuestion.source.licenseUrl} target="_blank" rel="noreferrer">
                              {activeQuestion.source.license}
                            </a>
                            <small>{activeQuestion.source.attribution}</small>
                            <small>{activeQuestion.source.adaptation}</small>
                          </p>
                        )}
                        {activeQuestion.lookupTerm && <VocabularyLookup term={activeQuestion.lookupTerm} />}
                        <div className="feedback-actions">
                          <button className="next-button" type="button" onClick={nextQuestion}>
                            {phase === 'review'
                              ? reviewCursor === roundMistakes.length - 1 ? '查看自测结果' : '下一道错题'
                              : isFinalPracticeQuestion ? '查看阶段自测' : '下一题'} <span aria-hidden="true">→</span>
                          </button>
                          {preferences.mode === 'reading' && phase === 'practice' && (
                            <button
                              className="question-report-button"
                              type="button"
                              aria-pressed={currentQuestionReported}
                              onClick={toggleCurrentQuestionFeedback}
                            >
                              {currentQuestionReported ? '已减少出现 · 撤销' : '题目有问题'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </article>
          )}
        </main>
      </div>

      {libraryOpen && (
        <div className="library-overlay" onClick={(event) => event.target === event.currentTarget && closeLibrary()}>
          <section
            ref={libraryDialogRef}
            className="library-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-dialog-heading"
            inert={resetConfirmOpen}
          >
            <div className="library-dialog-heading">
              <div>
                <p className="eyebrow">训练书架</p>
                <h2 id="library-dialog-heading">选择词库和训练类型</h2>
              </div>
              <button type="button" aria-label="关闭选择" onClick={closeLibrary} autoFocus>×</button>
            </div>

            <div className="book-shelf exam-book-shelf" role="radiogroup" aria-label="考试词库">
              {examLibraries.map((exam) => {
                const isReadingSelection = draftPreferences.mode === 'reading'
                const count = isReadingSelection
                  ? getQuestionIdsForExamLevel(questionBank.questions, exam, draftPreferences.level).length
                  : getWordsForExam(vocabularyBank.words, exam).length
                const detail = examDetails[exam]
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draftPreferences.exam === exam}
                    aria-label={`${detail.title}${isReadingSelection ? '句库' : '词库'}，${count}${isReadingSelection ? '题' : '词'}`}
                    className={`book-button ${draftPreferences.exam === exam ? 'book-active' : ''}`}
                    onClick={() => selectDraftExam(exam)}
                    key={exam}
                  >
                    <span className="book-spine" aria-hidden="true" />
                    <span className="book-cover">
                      <small>{isReadingSelection ? '句意训练语库' : '英语考试参考词库'}</small>
                      <strong>{detail.title}</strong>
                      <span>{detail.subtitle}</span>
                      <i>{count.toLocaleString()} {isReadingSelection ? '题' : '词'}</i>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="training-mode-section">
              <p className="section-label">训练类型</p>
              <div className="training-mode-options" role="radiogroup" aria-label="训练类型">
                {(Object.keys(modeDetails) as TrainingMode[]).map((mode) => {
                  const detail = modeDetails[mode]
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={draftPreferences.mode === mode}
                      aria-label={detail.title}
                      onClick={() => setDraftPreferences((current) => ({ ...current, mode }))}
                      key={mode}
                    >
                      <strong>{detail.title}</strong>
                      <span>{detail.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {draftPreferences.mode === 'reading' && (
              <div className="reading-level-section">
                <p className="section-label">阅读难度</p>
                <div className="level-options" role="radiogroup" aria-label="阅读难度">
                  {trainingLevels.map((level) => {
                    const count = getQuestionIdsForExamLevel(questionBank.questions, draftPreferences.exam, level).length
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={draftPreferences.level === level}
                        onClick={() => setDraftPreferences((current) => ({ ...current, level: level as TrainingLevel }))}
                        key={level}
                      >
                        {level} · {count}题
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="library-data-note">
              词汇来自 ECDICT 考试标签；句意训练由 80 道人工考研题与 Tatoeba 开放例句组成，均不等同于官方完整题库。
              {' '}<a href={thirdPartyNoticeUrl} target="_blank" rel="noreferrer">查看数据来源与许可</a>
            </p>

            <div className="mistake-section">
              <button className="mistake-toggle" type="button" aria-expanded={mistakeListOpen} onClick={() => setMistakeListOpen((open) => !open)}>
                错题记录 {mistakes.length} · 今日到期 {dueMistakeCount} · 已排期 {scheduledMistakeCount} <span aria-hidden="true">{mistakeListOpen ? '−' : '+'}</span>
              </button>
              {mistakeListOpen && (
                mistakes.length === 0
                  ? <p className="empty-mistakes">还没有错题记录。</p>
                  : <ol className="mistake-records">
                      {mistakes.slice(0, 20).map((item) => (
                        <li key={item.key}>
                          <div><strong lang="en">{item.prompt}</strong><span>{item.status}</span></div>
                          <p>{examDetails[item.exam].title} · {modeDetails[item.mode].title} · 错 {item.wrongCount} 次 · {formatNextReview(item)}</p>
                        </li>
                      ))}
                    </ol>
              )}
            </div>

            <div className="library-dialog-footer">
              <p>
                <span className={`bank-status bank-status-${draftBankSource}`}>{bankLabels[draftBankSource]}</span>
                <span>已答 {progress.answered}</span>
                <span>正确率 {accuracy}%</span>
                <span>{draftPreferences.mode === 'reading' ? `${draftActiveIds.length.toLocaleString()}题` : `${draftActiveIds.length.toLocaleString()}词`}</span>
              </p>
              <div className="dialog-actions">
                <button ref={resetTriggerRef} type="button" onClick={() => setResetConfirmOpen(true)}>清空记录</button>
                <button className="start-training-button" type="button" onClick={applySelection} disabled={draftActiveIds.length === 0}>
                  {draftActiveIds.length === 0 ? '暂无可用内容' : '开始训练'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {resetConfirmOpen && (
        <div className="confirm-overlay" onClick={(event) => event.target === event.currentTarget && closeResetConfirm()}>
          <section
            ref={resetDialogRef}
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-heading"
            aria-describedby="reset-dialog-description"
          >
            <p className="confirm-kicker">不可撤销</p>
            <h2 id="reset-dialog-heading">清空训练记录？</h2>
            <p id="reset-dialog-description">当前答题进度、错题和题目反馈都会被删除。</p>
            <div className="confirm-actions">
              <button ref={cancelResetButtonRef} type="button" onClick={closeResetConfirm}>取消</button>
              <button className="confirm-danger" type="button" onClick={confirmResetAll}>确认清空</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default App
