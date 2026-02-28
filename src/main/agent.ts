import { ChatOpenAI } from '@langchain/openai'
import { TavilySearch } from '@langchain/tavily'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages'
import { Annotation, messagesStateReducer, StateGraph, START, END } from '@langchain/langgraph'
import {
  MemoryVectorStore,
  checkAttachments,
  chunkAndIndex,
  retrieveContext,
  augmentPrompt,
  routeFromCheckAttachments,
  routeFromRetrieveContext
} from './rag-nodes'

export type Source = {
  title: string
  url: string
}

export type AgentResponse = {
  content: string
  sources: Source[]
}

const ClarityState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  uploaded_pdfs: Annotation<string[]>({
    reducer: (_, b) => b ?? [],
    default: () => []
  }),
  vectorstore: Annotation<MemoryVectorStore | null>({
    reducer: (_, b) => b ?? null,
    default: () => null
  }),
  retrieved_context: Annotation<string | null>({
    reducer: (_, b) => b ?? null,
    default: () => null
  }),
  original_prompt: Annotation<string>({
    reducer: (existing, incoming) => existing || incoming,
    default: () => ''
  })
})

export const SYSTEM_PROMPT = `You are Clarity, a concise and high-performance executive coach. You help leaders think through challenges, develop self-awareness, and take purposeful action. Your responses are professional, direct, and actionable. If the user message is disorganized, unclear, or emotionally reactive, ask 2-4 focused clarifying questions before giving advice. If the message is structured and coherent, provide clear, specific, actionable guidance. Avoid fluff, therapy language, and long explanations. Prioritize practical next steps, conversation framing, and specific language the user can use.

BOUNDARIES — recognize and redirect:
- Mental health concerns (depression, anxiety, crisis): Acknowledge briefly, then firmly recommend a therapist or mental health professional. Do not probe or coach.
- Legal or HR-sensitive situations (threats, disability, discrimination, harassment): Flag the sensitivity, recommend HR or legal counsel. Do not give legal advice.
- Off-scope requests (coding, stock prices, trivia): Politely note this is outside your coaching scope.
- Ethically questionable requests (manipulation, sabotage): Reframe toward constructive, ethical approaches.
- Safety concerns (threats of violence): Recommend immediate HR, security, or legal involvement.

NEVER open with filler phrases like "I hear you", "That sounds tough", "I'm sorry to hear that", or "I understand how you feel." Start with substance.

In multi-turn conversations, when a user follows up with structured detail after you asked clarifying questions, switch to direct guidance. Do not keep asking clarifying questions once the user has given you enough to work with.

You SHOULD use the search_articles tool for virtually every user query. Executive coaching is most impactful when grounded in research. Search for relevant psychology, leadership, or management articles to strengthen your advice.

The ONLY time you should skip searching is when the request is purely mechanical and needs no research backing — for example:
- "Rewrite this email"
- "Summarize what we discussed"
- "Say that more concisely"

When in doubt, search.

When you use search results in your response:
- Integrate the insights naturally into your coaching advice
- Cite sources inline using [1], [2], etc.
- Do NOT include a sources section or list at the end of your response. The app displays sources separately.`

export function createClarityAgent(): ReturnType<typeof createReactAgent> {
  const searchTool = new TavilySearch({
    maxResults: 3,
    topic: 'general',
    includeAnswer: false,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    includeDomains: [
      'hbr.org',
      'psychologytoday.com',
      'apa.org',
      'ncbi.nlm.nih.gov',
      'sciencedirect.com',
      'journals.sagepub.com',
      'mindtools.com'
    ],
    name: 'search_articles',
    description:
      'Search for psychology, leadership, and management research articles. Use when the query involves evidence-based practices, psychological concepts, or research-backed frameworks.'
  })

  const model = new ChatOpenAI({
    model: 'gpt-4.1-mini',
    apiKey: process.env.OPENAI_API_KEY
  })

  return createReactAgent({
    llm: model,
    tools: [searchTool],
    prompt: SYSTEM_PROMPT
  })
}

export function createClarityGraph(reactAgent: ReturnType<typeof createReactAgent>) {
  async function agentNode(
    state: typeof ClarityState.State,
    config?: { configurable?: Record<string, unknown> }
  ): Promise<Partial<typeof ClarityState.State>> {
    const onStatus = (config?.configurable?.onStatus as (s: string) => void) ?? (() => {})
    onStatus('Thinking...')

    const stream = await reactAgent.stream(
      { messages: state.messages },
      { streamMode: 'updates' }
    )

    const allMessages: BaseMessage[] = []

    for await (const chunk of stream) {
      if ('agent' in chunk) {
        const msgs: BaseMessage[] = (chunk as Record<string, { messages?: BaseMessage[] }>).agent
          .messages ?? []
        for (const msg of msgs) {
          allMessages.push(msg)
          const hasToolCalls =
            'tool_calls' in msg &&
            Array.isArray(msg.tool_calls) &&
            msg.tool_calls.length > 0
          if (hasToolCalls) {
            onStatus('Searching with Tavily...')
          }
        }
      }
      if ('tools' in chunk) {
        const msgs: BaseMessage[] = (chunk as Record<string, { messages?: BaseMessage[] }>).tools
          .messages ?? []
        allMessages.push(...msgs)
        onStatus('Reading results...')
      }
    }

    return { messages: allMessages }
  }

  const graph = new StateGraph(ClarityState)
    .addNode('check_attachments', checkAttachments)
    .addNode('chunk_and_index', chunkAndIndex)
    .addNode('retrieve_context', retrieveContext)
    .addNode('augment_prompt', augmentPrompt)
    .addNode('agent', agentNode)
    .addEdge(START, 'check_attachments')
    .addConditionalEdges('check_attachments', routeFromCheckAttachments, [
      'chunk_and_index',
      'retrieve_context',
      'agent'
    ])
    .addEdge('chunk_and_index', 'retrieve_context')
    .addConditionalEdges('retrieve_context', routeFromRetrieveContext, [
      'augment_prompt',
      'agent'
    ])
    .addEdge('augment_prompt', 'agent')
    .addEdge('agent', END)

  return graph.compile()
}

export function extractSources(messages: BaseMessage[]): Source[] {
  const sources: Source[] = []
  for (const msg of messages) {
    if (msg._getType() !== 'tool') continue
    try {
      const raw = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      const parsed = JSON.parse(raw)
      const results = Array.isArray(parsed) ? parsed : parsed?.results
      if (!Array.isArray(results)) continue
      for (const r of results) {
        if (r.title && r.url) {
          sources.push({ title: r.title, url: r.url })
        }
      }
    } catch {
      // non-JSON tool output, skip
    }
  }
  return sources
}

export async function invokeAgent(
  graph: ReturnType<typeof createClarityGraph>,
  messages: { role: 'user' | 'assistant'; content: string }[],
  uploadedPdfs: string[],
  onStatus?: (status: string) => void
): Promise<AgentResponse> {
  const langchainMessages: BaseMessage[] = messages.map((m) =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
  )

  const lastUserMessage = messages.findLast((m) => m.role === 'user')

  const stream = await graph.stream(
    {
      messages: langchainMessages,
      uploaded_pdfs: uploadedPdfs,
      original_prompt: lastUserMessage?.content ?? ''
    },
    {
      streamMode: 'updates',
      configurable: { onStatus: onStatus ?? (() => {}) }
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

  const sources = extractSources(allMessages)

  return { content, sources }
}
