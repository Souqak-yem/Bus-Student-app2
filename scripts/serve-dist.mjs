import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT || 4173)
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

const server = createServer(async (req, res) => {
  let requestPath
  try {
    requestPath = decodeURIComponent((req.url || '/').split('?')[0])
  } catch {
    res.statusCode = 400
    res.end('Invalid URL')
    return
  }

  const relativePath = normalize(requestPath).replace(/^([.][.][/\\])+/, '')
  const filePath = join(root, relativePath === '/' ? 'index.html' : relativePath)
  const safePath = filePath.startsWith(root) ? filePath : join(root, 'index.html')
  const target = await isFile(safePath) ? safePath : join(root, 'index.html')

  res.setHeader('Content-Type', mimeTypes[extname(target).toLowerCase()] || 'application/octet-stream')
  if (requestPath === '/sw.js') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Expires', '0')
  } else {
    res.setHeader('Cache-Control', target.endsWith('index.html')
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=31536000, immutable')
  }
  createReadStream(target).on('error', () => {
    res.statusCode = 500
    res.end('Unable to serve application')
  }).pipe(res)
})

await access(join(root, 'index.html'))
server.listen(port, '0.0.0.0', () => {
  console.log(`[Frontend] SPA server listening on port ${port}`)
})