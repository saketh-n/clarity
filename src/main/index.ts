import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import dotenv from 'dotenv'
import { createClarityAgent, invokeAgent } from './agent'

dotenv.config()

const agent = createClarityAgent()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#FFF8F0',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle(
  'chat:send',
  async (event, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    try {
      const result = await invokeAgent(agent, messages, (status) => {
        event.sender.send('chat:status', status)
      })
      return {
        success: true,
        content: result.content,
        sources: result.sources
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }
)

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
