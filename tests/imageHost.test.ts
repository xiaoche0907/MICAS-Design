declare const require: any
const assert = require('node:assert/strict')
const test = require('node:test') as (name: string, callback: () => void | Promise<void>) => void
import { uploadToImageHost } from '../ui/utils/imgbb'

;(globalThis as any).window = {
  setTimeout,
  clearTimeout,
}

test('ImgBB code 103 remains on ImgBB and never switches providers', async () => {
  const originalFetch = globalThis.fetch
  const requestedUrls: string[] = []
  ;(globalThis as any).fetch = async (input: string | URL | Request) => {
    requestedUrls.push(String(input))
    return new Response(JSON.stringify({
      success: false,
      status_code: 400,
      error: { message: 'You have been forbidden to use this website.', code: 103 },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await assert.rejects(
      () => uploadToImageHost('R0lGODlhAQABAIAAAAUEBA==', 'imgbb', 'imgbb-key'),
      /ImgBB 禁止了当前账号或请求出口.*103/
    )
    assert.ok(requestedUrls.length > 0)
    assert.ok(requestedUrls.every((url) => url === 'https://www.cxworking.xyz/api/imgbb'))
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

test('Freeimage uploads only through its CX Working route', async () => {
  const originalFetch = globalThis.fetch
  const requestedUrls: string[] = []
  ;(globalThis as any).fetch = async (input: string | URL | Request) => {
    requestedUrls.push(String(input))
    return new Response(JSON.stringify({ image: { url: 'http://images.example/freeimage.png' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await uploadToImageHost(
      'R0lGODlhAQABAIAAAAUEBA==',
      'freeimage',
      'freeimage-key'
    )
    assert.equal(result, 'https://images.example/freeimage.png')
    assert.deepEqual(requestedUrls, ['https://www.cxworking.xyz/api/freeimage'])
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})
