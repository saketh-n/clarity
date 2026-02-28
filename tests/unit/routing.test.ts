import { describe, it, expect, beforeEach } from 'vitest'
import {
  routeFromCheckAttachments,
  routeFromRetrieveContext,
  indexedPaths
} from '../../src/main/rag-nodes'
import type { ClarityState } from '../../src/main/rag-nodes'

function makeState(overrides: Partial<ClarityState> = {}): ClarityState {
  return {
    messages: [],
    uploaded_pdfs: [],
    vectorstore: null,
    retrieved_context: null,
    original_prompt: '',
    ...overrides
  }
}

describe('routeFromCheckAttachments', () => {
  beforeEach(() => {
    indexedPaths.clear()
  })

  it('routes to "agent" when no PDFs are uploaded', () => {
    expect(routeFromCheckAttachments(makeState())).toBe('agent')
  })

  it('routes to "agent" when uploaded_pdfs is empty', () => {
    expect(routeFromCheckAttachments(makeState({ uploaded_pdfs: [] }))).toBe('agent')
  })

  it('routes to "chunk_and_index" when there are new (un-indexed) PDFs', () => {
    expect(
      routeFromCheckAttachments(makeState({ uploaded_pdfs: ['/path/to/new.pdf'] }))
    ).toBe('chunk_and_index')
  })

  it('routes to "retrieve_context" when all PDFs are already indexed', () => {
    indexedPaths.add('/path/to/indexed.pdf')
    expect(
      routeFromCheckAttachments(makeState({ uploaded_pdfs: ['/path/to/indexed.pdf'] }))
    ).toBe('retrieve_context')
  })

  it('routes to "chunk_and_index" when mix of new and indexed PDFs', () => {
    indexedPaths.add('/path/to/old.pdf')
    expect(
      routeFromCheckAttachments(
        makeState({ uploaded_pdfs: ['/path/to/old.pdf', '/path/to/new.pdf'] })
      )
    ).toBe('chunk_and_index')
  })
})

describe('routeFromRetrieveContext', () => {
  it('routes to "augment_prompt" when retrieved_context is present', () => {
    expect(routeFromRetrieveContext(makeState({ retrieved_context: 'some text' }))).toBe(
      'augment_prompt'
    )
  })

  it('routes to "agent" when retrieved_context is null', () => {
    expect(routeFromRetrieveContext(makeState({ retrieved_context: null }))).toBe('agent')
  })
})
