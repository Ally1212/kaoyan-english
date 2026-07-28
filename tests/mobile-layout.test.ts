// @ts-expect-error Vitest runs in Node; the browser app intentionally does not include Node globals.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync('src/styles.css', 'utf8')

describe('mobile layout contract', () => {
  it('tracks dynamic mobile viewports without dropping the legacy fallback', () => {
    expect(styles).toMatch(/body\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/s)
    expect(styles).toMatch(/\.page-shell\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/s)
    expect(styles).toMatch(/\.library-dialog\s*{[^}]*100vh[^}]*100dvh/s)
  })

  it('respects all four mobile safe-area insets', () => {
    expect(styles).toContain('env(safe-area-inset-top)')
    expect(styles).toContain('env(safe-area-inset-right)')
    expect(styles).toContain('env(safe-area-inset-bottom)')
    expect(styles).toContain('env(safe-area-inset-left)')
  })

  it('keeps short screens top-aligned and moves tablet vocabulary hints into the document flow', () => {
    expect(styles).toMatch(/@media \(max-height: 680px\)[\s\S]*?main\s*{\s*align-self:\s*start;/)
    expect(styles).toMatch(/@media \(max-width: 840px\)[\s\S]*?\.vocabulary-panel\s*{[^}]*position:\s*static;/)
    expect(styles).toMatch(/@media \(max-width: 900px\) and \(max-height: 600px\)[\s\S]*?\.vocabulary-panel\s*{[^}]*position:\s*static;/)
  })

  it('allows long review prompts and option labels to wrap on narrow screens', () => {
    expect(styles).toMatch(/\.review-item-heading strong\s*{[^}]*overflow-wrap:\s*anywhere;/s)
    expect(styles).toMatch(/\.option > span:first-child\s*{[^}]*overflow-wrap:\s*anywhere;/s)
    expect(styles).toMatch(/@media \(max-width: 600px\)[\s\S]*?\.review-item-heading\s*{[^}]*flex-direction:\s*column;/)
  })
})
