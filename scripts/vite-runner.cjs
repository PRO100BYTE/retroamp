const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

const mode = process.argv[2]
if (!mode || (mode !== 'dev' && mode !== 'build' && mode !== 'preview')) {
  console.error('Usage: node scripts/vite-runner.cjs <dev|build|preview>')
  process.exit(1)
}

const viteBin = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error('Vite binary not found. Run: npm install')
  process.exit(1)
}

const args = [viteBin]
if (mode === 'dev') {
  args.push('--config', 'vite.renderer.config.mjs')
} else if (mode === 'build') {
  args.push('build', '--config', 'vite.renderer.config.mjs')
} else {
  args.push('preview', '--config', 'vite.renderer.config.mjs')
}

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  shell: false,
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
