import 'dotenv/config'
import OpenAI from 'openai'
import { createClarityAgent, createClarityGraph, type AgentResponse } from '../../src/main/agent'
import type { BaseMessage } from '@langchain/core/messages'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

let _graph: ReturnType<typeof createClarityGraph> | null = null

export function getGraph(): ReturnType<typeof createClarityGraph> {
  if (!_graph) {
    const reactAgent = createClarityAgent()
    _graph = createClarityGraph(reactAgent)
  }
  return _graph
}

export interface JudgeVerdict {
  pass: boolean
  score: number
  reasoning: string
}

export interface MultiDimensionVerdict {
  pass: boolean
  scores: Record<string, number>
  reasoning: string
}

export async function invokeClarity(
  input: string,
  uploadedPdfs: string[] = []
): Promise<AgentResponse & { allMessages: BaseMessage[] }> {
  const { invokeAgent } = await import('../../src/main/agent')
  const { HumanMessage, AIMessage } = await import('@langchain/core/messages')

  const graph = getGraph()
  const messages = [{ role: 'user' as const, content: input }]

  const langchainMessages = messages.map((m) =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
  )

  const stream = await graph.stream(
    {
      messages: langchainMessages,
      uploaded_pdfs: uploadedPdfs,
      original_prompt: input
    },
    {
      streamMode: 'updates',
      configurable: { onStatus: () => {} }
    }
  )

  const allMessages: BaseMessage[] = []

  for await (const chunk of stream) {
    if ('agent' in chunk) {
      const agentUpdate = (chunk as Record<string, { messages?: BaseMessage[] }>).agent
      if (agentUpdate.messages) {
        allMessages.push(...agentUpdate.messages)
      }
    }
  }

  const lastMessage = allMessages[allMessages.length - 1]
  const content =
    typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content)

  const { extractSources } = await import('../../src/main/agent')
  const sources = extractSources(allMessages)

  return { content, sources, allMessages }
}

export async function invokeClarityMultiTurn(
  turns: { role: 'user' | 'assistant'; content: string }[],
  uploadedPdfs: string[] = []
): Promise<AgentResponse & { allMessages: BaseMessage[] }> {
  const { HumanMessage, AIMessage } = await import('@langchain/core/messages')

  const graph = getGraph()
  const langchainMessages = turns.map((m) =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
  )

  const lastUserMessage = turns.findLast((m) => m.role === 'user')

  const stream = await graph.stream(
    {
      messages: langchainMessages,
      uploaded_pdfs: uploadedPdfs,
      original_prompt: lastUserMessage?.content ?? ''
    },
    {
      streamMode: 'updates',
      configurable: { onStatus: () => {} }
    }
  )

  const allMessages: BaseMessage[] = []

  for await (const chunk of stream) {
    if ('agent' in chunk) {
      const agentUpdate = (chunk as Record<string, { messages?: BaseMessage[] }>).agent
      if (agentUpdate.messages) {
        allMessages.push(...agentUpdate.messages)
      }
    }
  }

  const lastMessage = allMessages[allMessages.length - 1]
  const content =
    typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content)

  const { extractSources } = await import('../../src/main/agent')
  const sources = extractSources(allMessages)

  return { content, sources, allMessages }
}

export async function callJudge(systemPrompt: string, userPrompt: string): Promise<JudgeVerdict> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  return {
    pass: parsed.pass ?? false,
    score: parsed.score ?? 0,
    reasoning: parsed.reasoning ?? ''
  }
}

export async function callMultiDimensionJudge(
  systemPrompt: string,
  userPrompt: string
): Promise<MultiDimensionVerdict> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  return {
    pass: parsed.pass ?? false,
    scores: parsed.scores ?? {},
    reasoning: parsed.reasoning ?? ''
  }
}

export function hasToolCalls(messages: BaseMessage[]): boolean {
  return messages.some(
    (msg) =>
      'tool_calls' in msg &&
      Array.isArray((msg as Record<string, unknown>).tool_calls) &&
      ((msg as Record<string, unknown>).tool_calls as unknown[]).length > 0
  )
}
