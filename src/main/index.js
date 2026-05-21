import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { join, dirname, resolve, isAbsolute, basename, extname } from 'path'
import { readdir, readFile, writeFile } from 'fs/promises'
import { pathToFileURL } from 'url'
import { parseFile } from 'music-metadata'

const AUDIO_EXTS = new Set(['.mp3', '.flac', '.ogg', '.wav', '.aac', '.m4a', '.opus', '.wma', '.mp4'])
const WINDOW_MIN_NORMAL = { width: 720, height: 500 }
const WINDOW_MIN_COMPACT = { width: 330, height: 330 }

const isDev = process.env.NODE_ENV === 'development'

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    title: 'RetroAmp',
    icon: appIcon.isEmpty() ? undefined : appIcon,
    width: 960,
    height: 620,
    minWidth: WINDOW_MIN_NORMAL.width,
    minHeight: WINDOW_MIN_NORMAL.height,
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
  app.setName('RetroAmp')
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

  const guessAudioMime = (fileName) => {
    const ext = extname(fileName).toLowerCase()
    switch (ext) {
      case '.mp3': return 'audio/mpeg'
      case '.flac': return 'audio/flac'
      case '.ogg': return 'audio/ogg'
      case '.wav': return 'audio/wav'
      case '.aac': return 'audio/aac'
      case '.m4a': return 'audio/mp4'
      case '.mp4': return 'audio/mp4'
      case '.opus': return 'audio/ogg'
      case '.wma': return 'audio/x-ms-wma'
      default: return 'application/octet-stream'
    }
  }

  const extractBestArtist = (common, native) => {
    if (typeof common.artist === 'string' && common.artist.trim()) return common.artist.trim()
    if (Array.isArray(common.artists) && common.artists.length > 0) {
      const names = common.artists.map((name) => String(name).trim()).filter(Boolean)
      if (names.length > 0) return names.join(', ')
    }
    if (typeof common.albumartist === 'string' && common.albumartist.trim()) return common.albumartist.trim()
    if (typeof common.composer === 'string' && common.composer.trim()) return common.composer.trim()

    const preferredIds = [
      'artist', 'artists', 'albumartist', 'album artist', 'performer', 'author', 'composer',
      'tpe1', 'tpe2', '©art', 'aart', 'wm/albumartist', 'wm/artist', 'authorurl'
    ]

    for (const values of Object.values(native || {})) {
      for (const entry of values || []) {
        const id = String(entry?.id || '').toLowerCase()
        const value = entry?.value
        if (!preferredIds.some((needle) => id.includes(needle))) continue

        if (typeof value === 'string' && value.trim()) return value.trim()
        if (Array.isArray(value)) {
          const names = value.map((item) => String(item).trim()).filter(Boolean)
          if (names.length > 0) return names.join(', ')
        }
      }
    }

    return null
  }

  const normalizePictureMime = (format) => {
    const value = String(format || '').toLowerCase().trim()
    if (!value) return null
    if (value === 'jpg' || value === 'image/jpg' || value === 'jpeg') return 'image/jpeg'
    if (value === 'png' || value === 'image/png') return 'image/png'
    if (value === 'gif' || value === 'image/gif') return 'image/gif'
    if (value === 'webp' || value === 'image/webp') return 'image/webp'
    if (value.startsWith('image/')) return value
    return null
  }

  const pictureScore = (picture) => {
    const hint = `${picture?.type || ''} ${picture?.name || ''} ${picture?.description || ''}`.toLowerCase()
    let score = 0
    if (hint.includes('front')) score += 100
    if (hint.includes('cover')) score += 80
    if (hint.includes('folder')) score += 60
    if (picture?.data?.length) score += Math.min(50, Math.floor(picture.data.length / 16384))
    return score
  }

  const pickBestPicture = (pictures) => {
    const valid = (pictures || []).filter((picture) => picture?.data && picture.data.length > 0)
    if (!valid.length) return null
    return [...valid].sort((a, b) => pictureScore(b) - pictureScore(a))[0]
  }

  const extractNativePictures = (nativeTags) => {
    const tags = []
    for (const values of Object.values(nativeTags || {})) {
      for (const entry of values || []) {
        const value = entry?.value
        if (Array.isArray(value)) {
          for (const sub of value) {
            if (sub?.data && sub.data.length > 0) tags.push(sub)
          }
        } else if (value?.data && value.data.length > 0) {
          tags.push(value)
        }
      }
    }
    return tags
  }

  const pictureToDataUrl = (picture) => {
    if (!picture?.data || picture.data.length === 0) return null
    const raw = Buffer.from(picture.data)
    const mime = normalizePictureMime(picture.format) || 'image/jpeg'
    return `data:${mime};base64,${raw.toString('base64')}`
  }

  const guessCoverMime = (fileName) => {
    const ext = extname(fileName).toLowerCase()
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.gif') return 'image/gif'
    return 'image/jpeg'
  }

  const coverFromImageFile = async (targetPath) => {
    try {
      const data = await readFile(targetPath)
      const raw = Buffer.from(data)
      const mime = guessCoverMime(targetPath)
      return `data:${mime};base64,${raw.toString('base64')}`
    } catch {
      return null
    }
  }

  const findExternalCover = async (audioPath) => {
    const dir = dirname(audioPath)
    const base = basename(audioPath, extname(audioPath))
    const candidates = [
      `${base}.jpg`, `${base}.jpeg`, `${base}.png`,
      'cover.jpg', 'cover.jpeg', 'cover.png',
      'folder.jpg', 'folder.jpeg', 'folder.png',
      'front.jpg', 'front.jpeg', 'front.png',
      'album.jpg', 'album.jpeg', 'album.png',
      'albumart.jpg', 'albumart.jpeg', 'albumart.png',
    ]
    for (const name of candidates) {
      const candidate = join(dir, name)
      const found = await coverFromImageFile(candidate)
      if (found) return found
    }
    return null
  }

  const out = await Promise.all(list.map(async (filePath) => {
    try {
      const meta = await parseFile(filePath, { duration: true, skipCovers: false })
      const common = meta.common || {}
      const native = meta.native || {}
      const format = meta.format || {}
      const fallbackTitle = basename(filePath, extname(filePath))
      const fallbackAlbum = basename(dirname(filePath)) || null
      const title = typeof common.title === 'string' && common.title.trim()
        ? common.title.trim()
        : fallbackTitle
      const artist = extractBestArtist(common, native)
      const album = typeof common.album === 'string' && common.album.trim()
        ? common.album.trim()
        : fallbackAlbum
      const commonPictures = Array.isArray(common.picture) ? common.picture : []
      const nativePictures = extractNativePictures(native)
      const embeddedPicture = pickBestPicture([...commonPictures, ...nativePictures])
      let cover = pictureToDataUrl(embeddedPicture)
      if (!cover) {
        cover = await findExternalCover(filePath)
      }
      return {
        path: filePath,
        title,
        artist,
        album,
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

ipcMain.handle('media:toFileUrl', async (_e, filePath) => {
  if (!filePath || typeof filePath !== 'string') return null
  try {
    return pathToFileURL(filePath).href
  } catch {
    return null
  }
})

ipcMain.handle('playlist:importM3U', async () => {
  const win = BrowserWindow.getAllWindows()[0]
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import M3U Playlist',
    properties: ['openFile'],
    filters: [{ name: 'M3U Playlist', extensions: ['m3u', 'm3u8'] }],
  })
  if (canceled || filePaths.length === 0) return []

  const m3uPath = filePaths[0]
  const baseDir = dirname(m3uPath)
  const body = await readFile(m3uPath, 'utf8')
  const lines = body.split(/\r?\n/)
  const out = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const path = isAbsolute(line) ? line : resolve(baseDir, line)
    out.push(path)
  }
  return out
})

ipcMain.handle('playlist:exportM3U', async (_e, payload = {}) => {
  const win = BrowserWindow.getAllWindows()[0]
  const tracks = Array.isArray(payload.tracks) ? payload.tracks : []
  if (tracks.length === 0) return false

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export M3U Playlist',
    defaultPath: 'playlist.m3u8',
    filters: [{ name: 'M3U Playlist', extensions: ['m3u8'] }],
  })
  if (canceled || !filePath) return false

  const lines = ['#EXTM3U']
  for (const track of tracks) {
    const d = Number.isFinite(track.duration) ? Math.round(track.duration) : -1
    const artist = track.artist || ''
    const title = track.title || track.name || 'Unknown'
    lines.push(`#EXTINF:${d},${artist}${artist ? ' - ' : ''}${title}`)
    lines.push(track.path)
  }
  await writeFile(filePath, lines.join('\r\n'), 'utf8')
  return true
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

ipcMain.handle('window:setCompactMode', (_e, compactMode) => {
  const win = mainWindow || BrowserWindow.getAllWindows()[0]
  if (!win) return false

  const min = compactMode ? WINDOW_MIN_COMPACT : WINDOW_MIN_NORMAL
  win.setMinimumSize(min.width, min.height)

  if (!compactMode) {
    const [w, h] = win.getSize()
    if (w < min.width || h < min.height) {
      win.setSize(Math.max(w, min.width), Math.max(h, min.height))
    }
  }

  return true
})
