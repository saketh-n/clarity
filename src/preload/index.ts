import { contextBridge, ipcRenderer } from 'electron'

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

const api = {
  sendMessage: (messages: ChatMessage[]): Promise<ChatResponse> => {
    return ipcRenderer.invoke('chat:send', messages)
  },
  onStatus: (callback: (status: string) => void): void => {
    ipcRenderer.on('chat:status', (_event, status: string) => callback(status))
  },
  offStatus: (): void => {
    ipcRenderer.removeAllListeners('chat:status')
  },
  selectPdf: (): Promise<{ name: string; path: string }[]> => {
    return ipcRenderer.invoke('dialog:openPdf')
  }
}

contextBridge.exposeInMainWorld('api', api)
