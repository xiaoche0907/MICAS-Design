declare const require: any
const assert = require('node:assert/strict')
const test = require('node:test') as (name: string, callback: () => void | Promise<void>) => void
import { uploadToImageHost } from '../ui/utils/imgbb'

;(globalThis as any).window = {
  setTimeout,
  clearTimeout,
}

test('ImgBB code 103 tries direct and relay without switching providers', async () => {
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
      /ImgBB 上游已禁止当前请求来源.*103/
    )
    assert.equal(requestedUrls.length, 2)
    assert.match(requestedUrls[0], /^https:\/\/api\.imgbb\.com\/1\/upload\?key=/)
    assert.equal(requestedUrls[1], 'https://www.cxworking.xyz/api/imgbb')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

test('ImgBB falls back to CX Working when direct upload is unavailable', async () => {
  const originalFetch = globalThis.fetch
  const requestedUrls: string[] = []
  ;(globalThis as any).fetch = async (input: string | URL | Request) => {
    const url = String(input)
    requestedUrls.push(url)
    if (url.startsWith('https://api.imgbb.com/')) {
      throw new TypeError('Failed to fetch')
    }
    return new Response(JSON.stringify({ data: { url: 'https://images.example/imgbb.png' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await uploadToImageHost('R0lGODlhAQABAIAAAAUEBA==', 'imgbb', 'imgbb-key')
    assert.equal(result, 'https://images.example/imgbb.png')
    assert.equal(requestedUrls.length, 2)
    assert.equal(requestedUrls[1], 'https://www.cxworking.xyz/api/imgbb')
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
