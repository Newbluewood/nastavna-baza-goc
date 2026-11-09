import { describe, expect, it } from 'vitest'
import { renderSafeMarkdown } from './safeMarkdown'

describe('renderSafeMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(renderSafeMarkdown('')).toBe('')
    expect(renderSafeMarkdown(null)).toBe('')
  })

  it('renders basic markdown', () => {
    const html = renderSafeMarkdown('**bold** and a [link](https://example.com)')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('href="https://example.com"')
  })

  it('strips script tags from markdown HTML', () => {
    const html = renderSafeMarkdown('<script>alert(1)</script>Hello')
    expect(html).not.toMatch(/<script/i)
    expect(html).toContain('Hello')
  })

  it('strips inline event handlers', () => {
    const html = renderSafeMarkdown('<img src=x onerror="alert(1)">')
    expect(html).not.toMatch(/onerror/i)
  })
})
