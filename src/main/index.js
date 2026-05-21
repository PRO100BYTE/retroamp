import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readdir } from 'fs/promises'
import { parseFile } from 'music-metadata'

const AUDIO_EXTS = new Set(['.mp3', '.flac', '.ogg', '.wav', '.aac', '.m4a', '.opus', '.wma', '.mp4'])

const isDev = process.env.NODE_ENV === 'development'

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 620,
    minWidth: 720,
    minHeight: 500,
    frame: false,           // custom titlebar
    transparent: false,
    backgroundColor: '#030803',
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Allow file:// for local audio streaming in a trusted desktop app
      webSecurity: false
    }
  })

  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // Uncomment for devtools during development:
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC: File dialogs ────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFiles', async () => {
  const win = BrowserWindow.getAllWindows()[0]
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Add Audio Files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Audio Files',
        extensions: ['mp3', 'flac', 'ogg', 'wav', 'aac', 'm4a', 'opus', 'wma']
      },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return canceled ? [] : filePaths
})

ipcMain.handle('dialog:openFolder', async () => {
  const win = BrowserWindow.getAllWindows()[0]
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open Folder as Playlist',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) return []
  return collectAudioFiles(filePaths[0])
})

ipcMain.handle('media:readTags', async (_e, filePaths = []) => {
  const list = Array.isArray(filePaths) ? filePaths : []
  const out = await Promise.all(list.map(async (filePath) => {
    try {
      const meta = await parseFile(filePath, { duration: true, skipCovers: false })
      const common = meta.common || {}
      const format = meta.format || {}
      const pic = Array.isArray(common.picture) ? common.picture[0] : null
      let cover = null
      if (pic?.data) {
        const mime = pic.format || 'image/jpeg'
        cover = `data:${mime};base64,${Buffer.from(pic.data).toString('base64')}`
      }
      return {
        path: filePath,
        title: common.title || null,
        artist: common.artist || null,
        album: common.album || null,
        year: common.year || null,
        duration: Number.isFinite(format.duration) ? format.duration : null,
        cover,
      }
    } catch {
      return { path: filePath }
    }
  }))
  return out
})

async function collectAudioFiles(dir) {
  const results = []
  async function walk(d) {
    try {
      const entries = await readdir(d, { withFileTypes: true })
      for (const entry of entries) {
        const full = join(d, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (entry.isFile()) {
          const dot = entry.name.lastIndexOf('.')
          if (dot !== -1) {
            const ext = entry.name.slice(dot).toLowerCase()
            if (AUDIO_EXTS.has(ext)) results.push(full)
          }
        }
      }
    } catch { /* skip unreadable dirs */ }
  }
  await walk(dir)
  results.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  return results
}

// ── IPC: Window controls ─────────────────────────────────────────────────────

ipcMain.on('window:minimize', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.minimize()
})
ipcMain.on('window:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on('window:close', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.close()
})
