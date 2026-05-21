const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join, dirname } = require('node:path')

const args = process.argv.slice(2)
const command = args[0]

if (!command) {
  console.error('Usage: node scripts/tauri-runner.cjs <dev|build|...>')
  process.exit(1)
}

const env = { ...process.env }

const nodeDir = dirname(process.execPath)
if (nodeDir && existsSync(nodeDir)) {
  if (process.platform === 'win32') {
    env.PATH = `${nodeDir};${env.PATH || ''}`
  } else {
    env.PATH = `${nodeDir}:${env.PATH || ''}`
  }
}

if (process.platform === 'win32') {
  const cargoBin = join(env.USERPROFILE || '', '.cargo', 'bin')
  if (cargoBin && existsSync(cargoBin)) {
    env.PATH = `${cargoBin};${env.PATH || ''}`
  }
}

const tauriBin = join(process.cwd(), 'node_modules', '@tauri-apps', 'cli', 'tauri.js')

if (!existsSync(tauriBin)) {
  console.error('Tauri CLI binary not found. Run: npm install')
  process.exit(1)
}

const child = spawn(process.execPath, [tauriBin, ...args], {
  stdio: 'inherit',
  shell: false,
  env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
