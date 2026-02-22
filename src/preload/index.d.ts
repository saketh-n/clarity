export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatResponse = {
  success: boolean
  content?: string
  error?: string
}

declare global {
  interface Window {
    api: {
      sendMessage: (messages: ChatMessage[]) => Promise<ChatResponse>
    }
  }
}
