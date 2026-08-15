import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const originalEnv = { ...process.env }

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key]
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value
  }
}

test('production rejects missing VAPID keys without generating or writing a file', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vapid-prod-'))
  const tempFile = path.join(tempDir, '.vapid.json')

  try {
    process.env.NODE_ENV = 'production'
    process.env.VAPID_PUBLIC_KEY = ''
    process.env.VAPID_PRIVATE_KEY = ''
    process.env.VAPID_FILE_PATH = tempFile

    const moduleUrl = `${pathToFileURL(path.resolve('src/services/pushNotificationService.js')).href}?t=${Date.now()}`
    await assert.rejects(async () => {
      await import(moduleUrl)
    }, /VAPID.*required.*production/i)

    assert.equal(fs.existsSync(tempFile), false)
  } finally {
    delete process.env.VAPID_FILE_PATH
    resetEnv()
  }
})
