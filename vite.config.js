import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

const pkgPath = resolve(__dirname, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch { return 'dev' }
}

function getBuildTime() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function autoVersionPlugin() {
  return {
    name: 'auto-version',
    buildStart() {
      const [major, minor, patch] = pkg.version.split('.').map(Number)
      pkg.version = `${major}.${minor}.${(patch || 0) + 1}`
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
    },
  }
}

function swCacheVersionPlugin() {
  return {
    name: 'sw-cache-version',
    closeBundle() {
      const distSw = resolve(__dirname, 'dist/sw.js')
      try {
        let content = readFileSync(distSw, 'utf-8')
        const hash = Date.now().toString(36)
        content = content.replace(
          /const CACHE = ['"]mashawerk-v\d+['"]/,
          `const CACHE = 'mashawerk-${hash}'`
        )
        writeFileSync(distSw, content, 'utf-8')
      } catch { /* sw.js not in dist, skip */ }
    },
  }
}

const gitHash = getGitHash()
const buildTime = getBuildTime()

export default defineConfig({
  plugins: [tailwindcss(), react(), autoVersionPlugin(), swCacheVersionPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
  },
})
