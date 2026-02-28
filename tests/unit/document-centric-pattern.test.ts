import { describe, it, expect } from 'vitest'
import { DOCUMENT_CENTRIC_PATTERN } from '../../src/main/rag-nodes'

describe('DOCUMENT_CENTRIC_PATTERN', () => {
  const positiveMatches = [
    'summarize this document',
    'what does the pdf say about leadership',
    'based on this, what should I prioritize',
    'in the file, what are the key findings',
    "what's in the uploaded report",
    'from the pdf, list the recommendations',
    'the document mentions three frameworks',
    'what was attached earlier'
  ]

  for (const input of positiveMatches) {
    it(`matches: "${input}"`, () => {
      expect(DOCUMENT_CENTRIC_PATTERN.test(input)).toBe(true)
    })
  }

  const negativeMatches = [
    'how do I give tough feedback',
    'my team is underperforming',
    'help me prepare for a board meeting',
    'I need to delegate more effectively'
  ]

  for (const input of negativeMatches) {
    it(`does not match: "${input}"`, () => {
      expect(DOCUMENT_CENTRIC_PATTERN.test(input)).toBe(false)
    })
  }

  it('matches case-insensitively (uppercase)', () => {
    expect(DOCUMENT_CENTRIC_PATTERN.test('THIS DOCUMENT')).toBe(true)
  })

  it('matches with trailing punctuation', () => {
    expect(DOCUMENT_CENTRIC_PATTERN.test('the pdf.')).toBe(true)
  })

  it('matches "the document" substring in "update the documentation" (known false positive)', () => {
    expect(DOCUMENT_CENTRIC_PATTERN.test('update the documentation')).toBe(true)
  })
})
