declare const require: any
const assert = require('node:assert/strict')
const test = require('node:test') as (name: string, callback: () => void) => void
import { chooseChromaKey, quickCutout } from '../ui/utils/quickCutout'

class TestImageData {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data
    this.width = width
    this.height = height
  }
}

;(globalThis as any).ImageData = TestImageData

function image(width: number, height: number, fill: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) data.set(fill, index * 4)
  return new TestImageData(data, width, height) as unknown as ImageData
}

function setPixel(source: ImageData, x: number, y: number, pixel: [number, number, number, number]) {
  source.data.set(pixel, (y * source.width + x) * 4)
}

test('removes only edge-connected white background and protects internal white', () => {
  const source = image(12, 12, [255, 255, 255, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(source, x, y, [36, 42, 50, 255])
  }
  setPixel(source, 6, 6, [255, 255, 255, 255])
  setPixel(source, 5, 5, [36, 42, 50, 123])

  const result = quickCutout(source, { feather: 2 })
  assert.equal(result.success, true)
  assert.equal(result.imageData.data[0 * 4 + 3], 0)
  assert.equal(result.imageData.data[(6 * 12 + 6) * 4 + 3], 255)
  assert.equal(result.imageData.data[(5 * 12 + 5) * 4 + 3], 123)
  assert.ok(result.stats.removedRatio > 0.5)
})

test('accepts a near-white border and creates a soft alpha transition', () => {
  const source = image(12, 12, [248, 248, 248, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(source, x, y, [40, 45, 50, 255])
  }
  const result = quickCutout(source, { feather: 2 })
  assert.equal(result.success, true)
  const edgeAlpha = result.imageData.data[(2 * 12 + 3) * 4 + 3]
  assert.ok(edgeAlpha > 0 && edgeAlpha < 255)
})

test('keeps a meaningful transparent PNG unchanged instead of routing to AI', () => {
  const source = image(10, 10, [255, 255, 255, 0])
  for (let y = 2; y < 8; y += 1) {
    for (let x = 2; x < 8; x += 1) setPixel(source, x, y, [28, 34, 40, 255])
  }
  setPixel(source, 4, 4, [200, 210, 220, 120])
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.deepEqual(Array.from(result.imageData.data), Array.from(source.data))
  assert.equal(result.imageData.data[(4 * 10 + 4) * 4 + 3], 120)
})

test('decontaminates a light matte edge without changing opaque subject alpha', () => {
  const source = image(12, 12, [255, 255, 255, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(source, x, y, [32, 40, 48, 255])
  }
  setPixel(source, 2, 3, [245, 245, 245, 255])
  const result = quickCutout(source, { feather: 2 })
  assert.equal(result.success, true)
  const offset = (3 * 12 + 2) * 4
  assert.ok(result.imageData.data[offset + 3] > 0 && result.imageData.data[offset + 3] < 255)
  assert.ok(result.imageData.data[offset] < 245)
})

test('allows a subject to reasonably touch only the bottom edge', () => {
  const source = image(12, 12, [255, 255, 255, 255])
  for (let y = 5; y < 12; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(source, x, y, [32, 38, 45, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.stats.touchesForegroundEdge, true)
  assert.ok(result.stats.edgeBackgroundRatios.top > 0.9)
  assert.ok(result.stats.edgeBackgroundRatios.left > 0.5)
})

test('allows a non-rectangular subject with a narrow head and broad shoulders', () => {
  const source = image(24, 24, [255, 255, 255, 255])
  // Narrow head, then a wider torso/shoulder silhouette reaching the bottom.
  for (let y = 3; y < 8; y += 1) {
    for (let x = 9; x < 15; x += 1) setPixel(source, x, y, [42, 48, 56, 255])
  }
  for (let y = 8; y < 14; y += 1) {
    for (let x = 6; x < 18; x += 1) setPixel(source, x, y, [42, 48, 56, 255])
  }
  for (let y = 14; y < 24; y += 1) {
    for (let x = 4; x < 20; x += 1) setPixel(source, x, y, [42, 48, 56, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.notEqual(result.reason, 'subject-background-collision')
})

test('rejects severe contact on three edges', () => {
  const source = image(12, 12, [255, 255, 255, 255])
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 12; x += 1) setPixel(source, x, y, [32, 38, 45, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, false)
  assert.equal(result.reason, 'unsupported-background')
})

test('chooses a collision-minimizing key for green screens and clothing', () => {
  const greenScreen = image(12, 12, [0, 190, 64, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(greenScreen, x, y, [245, 245, 245, 255])
  }
  assert.notEqual(chooseChromaKey(greenScreen), null)
  assert.equal(quickCutout(greenScreen).success, true)

  const greenClothing = image(12, 12, [255, 255, 255, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(greenClothing, x, y, [0, 190, 64, 255])
  }
  assert.notEqual(chooseChromaKey(greenClothing), 'green')

  const magentaClothing = image(12, 12, [255, 255, 255, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(magentaClothing, x, y, [255, 0, 255, 255])
  }
  assert.notEqual(chooseChromaKey(magentaClothing), 'magenta')
})

test('rejects a mismatched expected background without changing pixels', () => {
  const source = image(12, 12, [255, 255, 255, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(source, x, y, [40, 45, 50, 255])
  }
  const before = Array.from(source.data)
  const result = quickCutout(source, { expectedBackground: [0, 190, 64] })
  assert.equal(result.reason, 'expected-background-mismatch')
  assert.deepEqual(Array.from(result.imageData.data), before)
})

test('returns subject-background-collision for white clothing joined to white background', () => {
  const source = image(20, 20, [255, 255, 255, 255])
  for (let y = 2; y < 7; y += 1) {
    for (let x = 8; x < 13; x += 1) setPixel(source, x, y, [35, 35, 40, 255])
  }
  for (let y = 6; y < 11; y += 1) {
    for (let x = 7; x < 14; x += 1) setPixel(source, x, y, [190, 135, 105, 255])
  }
  for (let y = 10; y < 19; y += 1) {
    for (let x = 4; x < 17; x += 1) setPixel(source, x, y, [255, 255, 255, 255])
  }
  setPixel(source, 10, 13, [24, 28, 32, 255])
  const before = Array.from(source.data)
  const result = quickCutout(source)
  assert.equal(result.reason, 'subject-background-collision')
  assert.deepEqual(Array.from(result.imageData.data), before)
})

test('feather alpha decreases monotonically away from the subject', () => {
  const source = image(12, 12, [255, 255, 255, 255])
  for (let y = 4; y < 8; y += 1) {
    for (let x = 4; x < 8; x += 1) setPixel(source, x, y, [40, 45, 50, 255])
  }
  const result = quickCutout(source, { feather: 3 })
  assert.equal(result.success, true)
  const alphaAt = (y: number) => result.imageData.data[(y * 12 + 5) * 4 + 3]
  assert.ok(alphaAt(3) >= alphaAt(2))
  assert.ok(alphaAt(2) >= alphaAt(1))
  assert.equal(alphaAt(1), 0)
})

test('rejects complex or coloured borders for safe AI fallback', () => {
  const source = image(10, 10, [80, 120, 180, 255])
  for (let x = 0; x < 10; x += 1) {
    setPixel(source, x, 0, x % 2 ? [210, 90, 40, 255] : [30, 170, 220, 255])
    setPixel(source, x, 9, x % 2 ? [40, 200, 80, 255] : [180, 30, 190, 255])
  }
  for (let y = 3; y < 7; y += 1) {
    for (let x = 3; x < 7; x += 1) setPixel(source, x, y, [20, 30, 40, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, false)
  assert.equal(result.reason, 'unsupported-background')
  assert.equal(result.stats.complexBackground, true)
})

test('rejects a subject touching the canvas edge instead of clipping it', () => {
  const source = image(10, 10, [255, 255, 255, 255])
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 6; x += 1) setPixel(source, x, y, [20, 30, 40, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, false)
  assert.equal(result.reason, 'unsupported-background')
  assert.equal(result.stats.touchesForegroundEdge, true)
})

test('rejects an image with no meaningful background', () => {
  const source = image(10, 10, [255, 255, 255, 255])
  const result = quickCutout(source)
  assert.equal(result.success, false)
  assert.equal(result.reason, 'mostly-background')
})

test('rejects invalid and oversized image data safely', () => {
  const invalid = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as unknown as ImageData
  assert.equal(quickCutout(invalid).reason, 'invalid-image')
  const oversized = { width: 2049, height: 2, data: new Uint8ClampedArray(2049 * 2 * 4) } as unknown as ImageData
  assert.equal(quickCutout(oversized).reason, 'image-too-large')
})
