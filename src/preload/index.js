import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openFiles:   () => ipcRenderer.invoke('dialog:openFiles'),
  openFolder:  () => ipcRenderer.invoke('dialog:openFolder'),
  readTags:    (paths) => ipcRenderer.invoke('media:readTags', paths),
  readAudioSource: (filePath) => ipcRenderer.invoke('media:readAudioSource', filePath),
  importM3U:   () => ipcRenderer.invoke('playlist:importM3U'),
  exportM3U:   (payload) => ipcRenderer.invoke('playlist:exportM3U', payload),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // Window state events
  onMaximized: (cb) => {
    const listener = (_e, val) => cb(val)
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  }
})
