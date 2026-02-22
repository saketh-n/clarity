import { useState, useRef, useEffect, type FormEvent } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

function App(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

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
        setMessages((prev) => [...prev, { role: 'assistant', content: response.content! }])
      } else {
        setError(response.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Failed to connect. Please check your setup.')
    } finally {
      setLoading(false)
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
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-amber-warm to-coral text-white rounded-br-md shadow-md'
                  : 'bg-white text-slate-warm rounded-bl-md shadow-sm border border-cream-dark'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-cream-dark">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-warm animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-amber-bright animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-orange-soft animate-bounce [animation-delay:0.3s]" />
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
