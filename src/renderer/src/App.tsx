import { useState, useRef, useEffect, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Source = {
  title: string
  url: string
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

function prepareCitations(content: string, sources?: Source[]): string {
  let text = content.replace(/\n\*{0,2}Sources:?\*{0,2}\n(\[\d+\].*\n?)+$/i, '').trimEnd()

  if (sources?.length) {
    sources.forEach((src, i) => {
      const citation = `[${i + 1}]`
      const link = `[\\[${i + 1}\\]](${src.url})`
      text = text.replaceAll(citation, link)
    })
  }

  return text
}

function App(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.onStatus((s) => setStatus(s))
    return () => window.api.offStatus()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, status])

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setError(null)
    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await window.api.sendMessage(updatedMessages)
      if (response.success && response.content) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.content!,
            sources: response.sources
          }
        ])
      } else {
        setError(response.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Failed to connect. Please check your setup.')
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-cream text-slate-warm">
      {/* Draggable title bar region */}
      <div className="h-12 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Header */}
      <header className="flex-shrink-0 px-6 pb-4">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-coral to-amber-warm bg-clip-text text-transparent">
          Clarity
        </h1>
        <p className="text-sm text-slate-light mt-0.5">Your executive coach — think out loud.</p>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="text-5xl mb-4">✦</div>
              <p className="text-slate-light text-lg leading-relaxed">
                What's on your mind today? Share a challenge, decision, or goal and let's think it through together.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%]">
              <div
                className={`rounded-2xl px-4 py-3 leading-relaxed ${
                  msg.role === 'user'
                    ? 'whitespace-pre-wrap bg-gradient-to-br from-amber-warm to-coral text-white rounded-br-md shadow-md'
                    : 'bg-white text-slate-warm rounded-bl-md shadow-sm border border-cream-dark prose prose-stone prose-sm max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-blockquote:my-2 prose-a:text-coral prose-a:no-underline hover:prose-a:underline prose-code:text-coral/80 prose-code:before:content-none prose-code:after:content-none'
                }`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ children, href, ...props }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                          {children}
                        </a>
                      )
                    }}
                  >
                    {prepareCitations(msg.content, msg.sources)}
                  </ReactMarkdown>
                )}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-1.5 px-1 flex flex-wrap gap-1.5">
                  {msg.sources.map((src, j) => (
                    <a
                      key={j}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-slate-light hover:text-coral transition-colors bg-cream-dark/40 rounded-lg px-2 py-1"
                      title={src.title}
                    >
                      <span className="font-medium text-coral/70">[{j + 1}]</span>
                      <span className="truncate max-w-[180px]">{src.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-cream-dark">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-warm opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-warm" />
                </span>
                <span className="text-sm text-slate-light">
                  {status ?? 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2 border border-red-200">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 px-6 pb-6 pt-2"
      >
        <div className="flex gap-3 items-end bg-white rounded-2xl shadow-lg border border-cream-dark p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Type your thoughts..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-slate-warm placeholder:text-slate-light focus:outline-none text-base leading-relaxed"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-shrink-0 bg-gradient-to-r from-amber-warm to-coral text-white rounded-xl px-5 py-2.5 font-medium text-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
