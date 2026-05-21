import { createApp } from 'vue'
import App from './App.vue'
import './styles/App.css'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

if (!window.electronAPI) {
	const appWindow = getCurrentWindow()
	window.electronAPI = {
		openFiles: () => invoke('dialog_open_files'),
		openFolder: () => invoke('dialog_open_folder'),
		readTags: (paths) => invoke('media_read_tags', { paths }),
		readCover: (filePath) => invoke('media_read_cover', { path: filePath }),
		toFileUrl: (filePath) => invoke('media_to_file_url', { path: filePath }),
		minimize: () => appWindow.minimize(),
		maximize: () => appWindow.toggleMaximize(),
		close: () => appWindow.close(),
		setCompactMode: () => Promise.resolve(true),
		onMaximized: () => () => {},
		importM3U: async () => [],
		exportM3U: async () => false,
	}
}

createApp(App).mount('#root')
