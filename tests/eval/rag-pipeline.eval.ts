import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
import { invokeClarity, callJudge } from './harness'
import { RAG_JUDGE } from './judges'

const SAMPLE_PDF = resolve(__dirname, '../../sample-pr.pdf')

describe('RAG Pipeline — Document-Centric Queries', () => {
  it('summarizes the uploaded performance review', async () => {
    const result = await invokeClarity('Summarize this document.', [SAMPLE_PDF])

    const verdict = await callJudge(
      RAG_JUDGE,
      `Scenario: Document-centric query. The user uploaded a performance review PDF and asked to summarize it.

User input: "Summarize this document."

Agent response:
${result.content}

Evaluate: Does the response reference specific content from a performance review (names, ratings, feedback themes, development areas)?`
    )

    expect(verdict.pass, verdict.reasoning).toBe(true)
  })

  it('extracts key areas for improvement from the document', async () => {
    const result = await invokeClarity(
      'What are the key areas for improvement in this document?',
      [SAMPLE_PDF]
    )

    const verdict = await callJudge(
      RAG_JUDGE,
      `Scenario: Document-centric targeted extraction. The user uploaded a performance review PDF and asked about areas for improvement.

User input: "What are the key areas for improvement in this document?"

Agent response:
${result.content}

Evaluate: Does the response cite specific improvement areas from the PDF content, not just generic coaching advice?`
    )

    expect(verdict.pass, verdict.reasoning).toBe(true)
  })
})

describe('RAG Pipeline — Unrelated Query With PDF Present', () => {
  it('does not reference PDF content for unrelated coaching questions', async () => {
    const result = await invokeClarity('How do I build executive presence?', [SAMPLE_PDF])

    const verdict = await callJudge(
      RAG_JUDGE,
      `Scenario: Unrelated query with PDF present. The user uploaded a performance review PDF but asked an unrelated coaching question.

User input: "How do I build executive presence?"

Agent response:
${result.content}

Evaluate: The response should be standard coaching advice about executive presence and should NOT reference specific content from the performance review PDF. The agent should treat this as a normal coaching query.`
    )

    expect(verdict.pass, verdict.reasoning).toBe(true)
  })
})

describe('RAG Pipeline — Blended Document + Coaching', () => {
  it('blends document content with coaching guidance', async () => {
    const result = await invokeClarity(
      'Based on this performance review, how should I approach the feedback conversation?',
      [SAMPLE_PDF]
    )

    const verdict = await callJudge(
      RAG_JUDGE,
      `Scenario: Blended document + coaching query. The user uploaded a performance review PDF and asked how to approach a feedback conversation based on its content.

User input: "Based on this performance review, how should I approach the feedback conversation?"

Agent response:
${result.content}

Evaluate: Does the response BOTH reference specific content from the performance review AND provide actionable coaching guidance for the feedback conversation?`
    )

    expect(verdict.pass, verdict.reasoning).toBe(true)
  })
})
