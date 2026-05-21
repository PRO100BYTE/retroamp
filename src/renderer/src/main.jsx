import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/App.css'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'

if (!window.electronAPI) {
	const appWindow = getCurrentWindow()
	window.electronAPI = {
		openFiles: () => invoke('dialog_open_files'),
		openFolder: () => invoke('dialog_open_folder'),
		readTags: (paths) => invoke('media_read_tags', { paths }),
		readCover: (filePath) => invoke('media_read_cover', { path: filePath }),
		toFileUrl: (filePath) => Promise.resolve(convertFileSrc(filePath)),
		readAudioDataUrl: (filePath) => invoke('media_read_audio_data_url', { path: filePath }),
		importM3U: () => invoke('playlist_import_m3u'),
		exportM3U: (payload) => {
			const tracks = Array.isArray(payload?.tracks) ? payload.tracks : []
			// Normalize types to match Rust TrackMeta struct
			const normalized = tracks.map((t) => ({
				path:     String(t.path || ''),
				title:    t.title  != null && String(t.title).trim()  ? String(t.title).trim()  : null,
				artist:   t.artist != null && String(t.artist).trim() ? String(t.artist).trim() : null,
				album:    t.album  != null && String(t.album).trim()  ? String(t.album).trim()  : null,
				year:     t.year   != null && Number.isInteger(Number(t.year)) && Number(t.year) > 0
				            ? Number(t.year)
				            : null,
				duration: typeof t.duration === 'number' && t.duration > 0 ? t.duration : null,
			}))
			return invoke('playlist_export_m3u', { tracks: normalized })
		},
		minimize: () => appWindow.minimize(),
		maximize: () => appWindow.toggleMaximize(),
		close: () => appWindow.close(),
		startDragging: () => appWindow.startDragging(),
		setCompactMode: async (compact) => {
			const width = compact ? 330 : 800
			const height = compact ? 330 : 600
			await appWindow.setSize(new LogicalSize(width, height))
			await appWindow.setMinSize(new LogicalSize(330, 330))
			return true
		},
		onMaximized: () => () => {},
	}
}

ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
