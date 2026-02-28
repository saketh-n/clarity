import { describe, it, expect } from 'vitest'
import { extractSources } from '../../src/main/agent'
import { ToolMessage, HumanMessage, AIMessage } from '@langchain/core/messages'

describe('extractSources', () => {
  it('extracts sources from a valid Tavily JSON array', () => {
    const toolMsg = new ToolMessage({
      content: JSON.stringify([
        { title: 'HBR Article', url: 'https://hbr.org/article-1' },
        { title: 'APA Study', url: 'https://apa.org/study-2' }
      ]),
      tool_call_id: 'call_1'
    })
    const sources = extractSources([toolMsg])
    expect(sources).toEqual([
      { title: 'HBR Article', url: 'https://hbr.org/article-1' },
      { title: 'APA Study', url: 'https://apa.org/study-2' }
    ])
  })

  it('extracts sources from a results wrapper object', () => {
    const toolMsg = new ToolMessage({
      content: JSON.stringify({
        results: [{ title: 'MindTools', url: 'https://mindtools.com/tips' }]
      }),
      tool_call_id: 'call_2'
    })
    const sources = extractSources([toolMsg])
    expect(sources).toEqual([{ title: 'MindTools', url: 'https://mindtools.com/tips' }])
  })

  it('skips entries missing title', () => {
    const toolMsg = new ToolMessage({
      content: JSON.stringify([{ url: 'https://hbr.org/no-title' }]),
      tool_call_id: 'call_3'
    })
    expect(extractSources([toolMsg])).toEqual([])
  })

  it('skips entries missing url', () => {
    const toolMsg = new ToolMessage({
      content: JSON.stringify([{ title: 'No URL Article' }]),
      tool_call_id: 'call_4'
    })
    expect(extractSources([toolMsg])).toEqual([])
  })

  it('does not throw on non-JSON tool message content', () => {
    const toolMsg = new ToolMessage({
      content: 'this is not json',
      tool_call_id: 'call_5'
    })
    expect(extractSources([toolMsg])).toEqual([])
  })

  it('ignores non-tool messages', () => {
    const messages = [
      new HumanMessage('hello'),
      new AIMessage('how can I help?'),
      new ToolMessage({
        content: JSON.stringify([{ title: 'Real Source', url: 'https://example.com' }]),
        tool_call_id: 'call_6'
      })
    ]
    expect(extractSources(messages)).toEqual([
      { title: 'Real Source', url: 'https://example.com' }
    ])
  })

  it('returns empty array for empty messages', () => {
    expect(extractSources([])).toEqual([])
  })

  it('handles object without results array', () => {
    const toolMsg = new ToolMessage({
      content: JSON.stringify({ answer: 'some text', query: 'test' }),
      tool_call_id: 'call_7'
    })
    expect(extractSources([toolMsg])).toEqual([])
  })
})
