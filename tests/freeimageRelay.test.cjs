const assert = require('node:assert/strict')
const test = require('node:test')
const handler = require('../api/freeimage')

const PNG_16X16 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGOosXr7nxLMMGrAqAGjBgwXAwBGOKIfnI4B3gAAAABJRU5ErkJggg=='

const createResponse = () => {
  const response = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
    end() { return this },
  }
  return response
}

test('Freeimage relay forwards Base64 as a typed multipart file', async () => {
  const originalFetch = globalThis.fetch
  let forwarded
  globalThis.fetch = async (_url, init) => {
    forwarded = init
    return new Response(JSON.stringify({ image: { url: 'https://iili.io/example.png' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = createResponse()
    await handler({
      method: 'POST',
      body: { key: 'freeimage-key', source: `data:image/png;base64,${PNG_16X16}`, name: 'connection test' },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.ok(forwarded.body instanceof FormData)
    assert.equal(forwarded.headers['Content-Type'], undefined)
    const file = forwarded.body.get('source')
    assert.equal(file.type, 'image/png')
    assert.equal(file.name, 'connection-test.png')
    assert.equal(file.size, 82)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Freeimage relay rejects non-image Base64 before contacting upstream', async () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; throw new Error('should not run') }

  try {
    const response = createResponse()
    await handler({ method: 'POST', body: { key: 'freeimage-key', source: 'bm90IGFuIGltYWdl' } }, response)
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.error.code, 130)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
