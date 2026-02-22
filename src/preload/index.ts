import { contextBridge, ipcRenderer } from 'electron'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatResponse = {
  success: boolean
  content?: string
  error?: string
}

const api = {
  sendMessage: (messages: ChatMessage[]): Promise<ChatResponse> => {
    return ipcRenderer.invoke('chat:send', messages)
  }
}

contextBridge.exposeInMainWorld('api', api)
