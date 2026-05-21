import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: resolve(process.cwd(), 'src/renderer'),
  build: {
    outDir: resolve(process.cwd(), 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
