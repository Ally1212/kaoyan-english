import { describe, expect, it } from 'vitest'
import { getOptionIndexForKey, keyBindings } from '../src/lib/keyboard'

describe('keyboard controls', () => {
  it('maps WASD to the four options in order', () => {
    expect(keyBindings).toEqual(['W', 'A', 'S', 'D'])
    expect(['w', 'a', 's', 'd'].map((key) => getOptionIndexForKey(key))).toEqual([0, 1, 2, 3])
    expect(getOptionIndexForKey('x')).toBe(-1)
  })
})
