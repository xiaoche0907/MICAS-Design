declare const require: any
const assert = require('node:assert/strict')
const test = require('node:test') as (name: string, callback: () => void | Promise<void>) => void
import { uploadToConfiguredImageHost } from '../ui/utils/imgbb'

;(globalThis as any).window = {
  setTimeout,
  clearTimeout,
}

const forbiddenResponse = () => new Response(JSON.stringify({
  success: false,
  status_code: 400,
  error: { message: 'You have been forbidden to use this website.', code: 103 },
}), {
  status: 400,
  headers: { 'Content-Type': 'application/json' },
})

test('ImgBB code 103 automatically falls back to configured Freeimage.host', async () => {
  const originalFetch = globalThis.fetch
  const requestedUrls: string[] = []
  ;(globalThis as any).fetch = async (input: string | URL | Request) => {
    const url = String(input)
    requestedUrls.push(url)
    if (url.includes('/api/freeimage')) {
      return new Response(JSON.stringify({ image: { url: 'http://images.example/fallback.png' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return forbiddenResponse()
  }

  try {
    const result = await uploadToConfiguredImageHost('R0lGODlhAQABAIAAAAUEBA==', {
      imageHostProvider: 'imgbb',
      imgbbApiKey: 'imgbb-key',
      freeimageApiKey: 'freeimage-key',
    }, 'fallback-test')
    assert.equal(result, 'https://images.example/fallback.png')
    assert.ok(requestedUrls.some((url) => url.includes('/api/imgbb')))
    assert.ok(requestedUrls.some((url) => url.includes('/api/freeimage')))
    assert.ok(requestedUrls.every((url) => url.startsWith('https://www.cxworking.xyz/')))
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

test('ImgBB code 103 remains explicit when no fallback is configured', async () => {
  const originalFetch = globalThis.fetch
  ;(globalThis as any).fetch = async () => forbiddenResponse()
  try {
    await assert.rejects(
      () => uploadToConfiguredImageHost('R0lGODlhAQABAIAAAAUEBA==', {
        imageHostProvider: 'imgbb',
        imgbbApiKey: 'imgbb-key',
      }),
      /ImgBB 禁止了当前账号或请求出口.*103/
    )
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})
