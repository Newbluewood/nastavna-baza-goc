import { marked } from 'marked'
import createDOMPurify from 'dompurify'

/**
 * Parse assistant markdown then sanitize before v-html.
 * Blocks script/event handlers from untrusted LLM output.
 */
export function renderSafeMarkdown(text) {
  if (!text) return ''
  const html = marked.parse(String(text))
  const root = typeof window !== 'undefined' ? window : undefined
  if (!root) return ''
  const purify = createDOMPurify(root)
  return purify.sanitize(html)
}
