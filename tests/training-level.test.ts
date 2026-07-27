import { describe, expect, it } from 'vitest'
import { questions } from '../src/data/questions'
import {
  TRAINING_LEVEL_STORAGE_KEY,
  getQuestionIdsForLevel,
  loadTrainingLevel,
  saveTrainingLevel,
} from '../src/lib/trainingLevel'

describe('training level', () => {
  it('filters the bundled bank into three difficulty pools', () => {
    expect(getQuestionIdsForLevel(questions, '全部')).toHaveLength(80)
    expect(getQuestionIdsForLevel(questions, '基础')).toHaveLength(26)
    expect(getQuestionIdsForLevel(questions, '进阶')).toHaveLength(38)
    expect(getQuestionIdsForLevel(questions, '挑战')).toHaveLength(16)
  })

  it('persists only a valid level selection', () => {
    window.localStorage.clear()
    saveTrainingLevel('挑战')
    expect(loadTrainingLevel()).toBe('挑战')

    window.localStorage.setItem(TRAINING_LEVEL_STORAGE_KEY, '不存在')
    expect(loadTrainingLevel()).toBe('全部')
  })
})
