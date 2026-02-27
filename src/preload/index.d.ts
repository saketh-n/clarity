export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type Source = {
  title: string
  url: string
}

export type ChatResponse = {
  success: boolean
  content?: string
  sources?: Source[]
  error?: string
}

declare global {
  interface Window {
    api: {
      sendMessage: (messages: ChatMessage[], pdfPaths: string[]) => Promise<ChatResponse>
      onStatus: (callback: (status: string) => void) => void
      offStatus: () => void
      selectPdf: () => Promise<{ name: string; path: string }[]>
    }
  }
}
