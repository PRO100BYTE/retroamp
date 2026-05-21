import { createApp } from 'vue'
import App from './App.vue'
import './styles/App.css'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'

if (!window.electronAPI) {
	const appWindow = getCurrentWindow()
	window.electronAPI = {
		openFiles: () => invoke('dialog_open_files'),
		openFolder: () => invoke('dialog_open_folder'),
		readTags: (paths) => invoke('media_read_tags', { paths }),
		readCover: (filePath) => invoke('media_read_cover', { path: filePath }),
		toFileUrl: (filePath) => invoke('media_to_file_url', { path: filePath }),
		importM3U: () => invoke('playlist_import_m3u'),
		exportM3U: (tracks) => invoke('playlist_export_m3u', { tracks }),
		minimize: () => appWindow.minimize(),
		maximize: () => appWindow.toggleMaximize(),
		close: () => appWindow.close(),
		setCompactMode: async (compact) => {
			const width = compact ? 330 : 800
			const height = compact ? 330 : 600
			await appWindow.setSize(new LogicalSize(width, height))
			await appWindow.setMinSize(new LogicalSize(width, height))
			return true
		},
		onMaximized: () => () => {},
	}
}

createApp(App).mount('#root')
