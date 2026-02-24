import { ChatOpenAI } from '@langchain/openai'
import { TavilySearch } from '@langchain/tavily'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages'

export type Source = {
  title: string
  url: string
}

export type AgentResponse = {
  content: string
  sources: Source[]
}

const SYSTEM_PROMPT = `You are Clarity, a concise and high-performance executive coach. You help leaders think through challenges, develop self-awareness, and take purposeful action. Your responses are professional, direct, and actionable. If the user message is disorganized, unclear, or emotionally reactive, ask 2-4 focused clarifying questions before giving advice. If the message is structured and coherent, provide clear, specific, actionable guidance. Avoid fluff, therapy language, and long explanations. Prioritize practical next steps, conversation framing, and specific language the user can use.

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

export async function invokeAgent(
  agent: ReturnType<typeof createReactAgent>,
  messages: { role: 'user' | 'assistant'; content: string }[],
  onStatus?: (status: string) => void
): Promise<AgentResponse> {
  const langchainMessages: BaseMessage[] = messages.map((m) =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
  )

  onStatus?.('Thinking...')

  const stream = await agent.stream(
    { messages: langchainMessages },
    { streamMode: 'updates' }
  )

  const allMessages: BaseMessage[] = []

  for await (const chunk of stream) {
    if ('agent' in chunk) {
      const msgs: BaseMessage[] = chunk.agent.messages ?? []
      for (const msg of msgs) {
        allMessages.push(msg)
        const hasToolCalls =
          'tool_calls' in msg &&
          Array.isArray(msg.tool_calls) &&
          msg.tool_calls.length > 0
        if (hasToolCalls) {
          onStatus?.('Searching with Tavily...')
        }
      }
    }
    if ('tools' in chunk) {
      const msgs: BaseMessage[] = chunk.tools.messages ?? []
      allMessages.push(...msgs)
      onStatus?.('Reading results...')
    }
  }

  const lastMessage = allMessages[allMessages.length - 1]
  const content =
    typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content)

  const sources: Source[] = []
  for (const msg of allMessages) {
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

  return { content, sources }
}
