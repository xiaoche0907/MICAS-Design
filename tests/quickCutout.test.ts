declare const require: any
const assert = require('node:assert/strict')
const test = require('node:test') as (name: string, callback: () => void | Promise<void>) => void
import { quickCutout } from '../ui/utils/quickCutout'
import { QuickCutoutWorkflow, formatQuickCutoutButtonStatus, quickCutoutReasonToChinese, scheduleQuickCutoutPreparationTimeout } from '../ui/utils/quickCutoutWorkflow'

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

test('removes a JPEG-noisy white background instead of fragmenting the flood', () => {
  const source = image(48, 64, [250, 250, 250, 255])
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const noise = ((x * 17 + y * 29) % 11) - 5
      const white = 250 + noise
      setPixel(source, x, y, [white, white, white, 255])
    }
  }
  for (let y = 10; y < 64; y += 1) {
    const halfWidth = y < 22 ? 5 : 13
    for (let x = 24 - halfWidth; x <= 24 + halfWidth; x += 1) {
      setPixel(source, x, y, [52, 45, 41, 255])
    }
  }

  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.stats.backgroundKind, 'near-white')
  assert.ok(result.stats.removedRatio > 0.5)
  assert.equal(result.imageData.data[3], 0)
  assert.equal(result.imageData.data[(32 * 48 + 24) * 4 + 3], 255)
})

test('treats a neutral studio background below 232 as white and stays local', () => {
  const source = image(20, 20, [226, 227, 225, 255])
  for (let y = 4; y < 18; y += 1) {
    for (let x = 6; x < 15; x += 1) setPixel(source, x, y, [40, 45, 52, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.stats.backgroundKind, 'near-white')
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
  setPixel(source, 2, 3, [250, 250, 250, 255])
  const result = quickCutout(source, { feather: 2 })
  assert.equal(result.success, true)
  const offset = (3 * 12 + 2) * 4
  assert.ok(result.imageData.data[offset + 3] > 0 && result.imageData.data[offset + 3] < 255)
  assert.ok(result.imageData.data[offset] < 250)
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

test('keeps two separate subjects on the same white background', () => {
  const source = image(40, 40, [255, 255, 255, 255])
  for (const center of [12, 28]) {
    for (let y = 5; y < 14; y += 1) {
      for (let x = center - 3; x <= center + 3; x += 1) setPixel(source, x, y, [70, 48, 38, 255])
    }
    for (let y = 14; y < 36; y += 1) {
      for (let x = center - 5; x <= center + 5; x += 1) setPixel(source, x, y, [38, 43, 52, 255])
    }
  }
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.imageData.data[(20 * 40 + 20) * 4 + 3], 0)
  assert.equal(result.imageData.data[(20 * 40 + 12) * 4 + 3], 255)
  assert.equal(result.imageData.data[(20 * 40 + 28) * 4 + 3], 255)
})

test('processes a portrait-like subject touching three edges locally', () => {
  const source = image(12, 12, [255, 255, 255, 255])
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 12; x += 1) setPixel(source, x, y, [32, 38, 45, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.imageData.data[(11 * 12 + 6) * 4 + 3], 0)
})

test('rejects a uniform non-white background without changing the source', () => {
  const source = image(12, 12, [40, 120, 180, 255])
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) setPixel(source, x, y, [30, 35, 40, 255])
  }
  const before = Array.from(source.data)
  const result = quickCutout(source)
  assert.equal(result.reason, 'non-white-background')
  assert.equal(result.stats.backgroundKind, 'non-white')
  assert.deepEqual(Array.from(result.imageData.data), before)
})

test('keeps a visibly separated off-white garment while removing white background', () => {
  const source = image(20, 20, [255, 255, 255, 255])
  for (let y = 2; y < 8; y += 1) {
    for (let x = 8; x < 13; x += 1) setPixel(source, x, y, [45, 38, 35, 255])
  }
  for (let y = 7; y < 18; y += 1) {
    for (let x = 5; x < 16; x += 1) setPixel(source, x, y, [242, 242, 240, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.imageData.data[(12 * 20 + 10) * 4 + 3], 255)
  assert.equal(result.imageData.data[3], 0)
})

test('completes locally when white pixels touch the white background', () => {
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
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.stats.subjectBackgroundCollision, true)
  assert.equal(result.imageData.data[3], 0)
  assert.equal(result.imageData.data[(13 * 20 + 10) * 4 + 3], 255)
})

test('removes an explicitly verified custom background colour', () => {
  const source = image(20, 20, [0, 255, 0, 255])
  for (let y = 3; y < 18; y += 1) {
    for (let x = 6; x < 15; x += 1) setPixel(source, x, y, [248, 248, 248, 255])
  }

  const result = quickCutout(source, { expectedBackground: [0, 255, 0] })
  assert.equal(result.success, true)
  assert.equal(result.stats.backgroundKind, 'non-white')
  assert.equal(result.imageData.data[3], 0)
  assert.equal(result.imageData.data[(10 * 20 + 10) * 4 + 3], 255)
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

test('rejects complex or coloured borders without changing the source', () => {
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

test('keeps an edge-touching subject while removing connected white background', () => {
  const source = image(10, 10, [255, 255, 255, 255])
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 6; x += 1) setPixel(source, x, y, [20, 30, 40, 255])
  }
  const result = quickCutout(source)
  assert.equal(result.success, true)
  assert.equal(result.stats.touchesForegroundEdge, true)
  assert.equal(result.imageData.data[(2 * 10 + 2) * 4 + 3], 255)
  assert.equal(result.imageData.data[(8 * 10 + 8) * 4 + 3], 0)
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

test('workflow commits white-background local output without AI', async () => {
  const workflow = new QuickCutoutWorkflow()
  const calls = { local: 0, commit: 0 }
  const phases: string[] = []
  const result = await workflow.execute('white', {
    onPhase: (phase) => phases.push(phase),
    localCutout: async () => { calls.local += 1; return { kind: 'transparent' as const, output: 'png' } },
    commit: async () => { calls.commit += 1 },
  })
  assert.equal(result.status, 'committed')
  assert.equal(workflow.isActive, false)
  assert.deepEqual(calls, { local: 1, commit: 1 })
  assert.deepEqual(phases, ['analyzing', 'local', 'commit'])
})

test('workflow preserves unsupported backgrounds without invoking another service', async () => {
  const workflow = new QuickCutoutWorkflow()
  const calls = { local: 0, commit: 0 }
  const phases: string[] = []
  const result = await workflow.execute('scene', {
    onPhase: (phase) => phases.push(phase),
    localCutout: async () => { calls.local += 1; return { kind: 'preserve-white' as const, reason: 'unsupported-background' } },
    commit: async () => { calls.commit += 1 },
  })
  assert.equal(result.status, 'preserved')
  assert.deepEqual(calls, { local: 1, commit: 0 })
  assert.deepEqual(phases, ['analyzing', 'local'])
})

test('workflow ignores a duplicate click while the first operation is active', async () => {
  const workflow = new QuickCutoutWorkflow()
  let releaseLocal: (() => void) | undefined
  let localCalls = 0
  let commits = 0
  const dependencies = {
    localCutout: async () => {
      localCalls += 1
      await new Promise<void>((resolve) => { releaseLocal = resolve })
      return { kind: 'transparent' as const, output: 'png' }
    },
    commit: async () => { commits += 1 },
  }
  const first = workflow.execute('source', dependencies)
  const duplicate = await workflow.execute('source', dependencies)
  assert.equal(duplicate.status, 'ignored')
  releaseLocal?.()
  const completed = await first
  assert.equal(completed.status, 'committed')
  assert.equal(localCalls, 1)
  assert.equal(commits, 1)
})

test('workflow failure reasons are mapped to specific Chinese messages', () => {
  assert.equal(quickCutoutReasonToChinese('subject-background-collision'), '白色主体与白色背景相连，无法安全分离')
  assert.equal(quickCutoutReasonToChinese('expected-background-mismatch'), 'AI 返回的中间背景不符合要求')
  assert.equal(quickCutoutReasonToChinese('download failed'), '图片下载或读取失败')
  assert.equal(quickCutoutReasonToChinese('插图确认超时'), '透明 PNG 插入画布失败')
  assert.equal(quickCutoutReasonToChinese('请配置您的 API Key (BYOK)'), '未配置 API Key，无法处理场景背景')
  assert.equal(quickCutoutReasonToChinese('参考图内容不可用'), '未读取到可处理的图片')
  assert.equal(quickCutoutReasonToChinese('AI 返回结果改变了原图比例'), 'AI 返回结果改变了原图比例，已停止插入')
})

test('preparation timeout can recover missing export responses and can be cancelled', () => {
  let scheduled: (() => void) | undefined
  let cleared = 0
  let timedOut = 0
  const timers = {
    set: (callback: () => void) => { scheduled = callback; return 7 },
    clear: () => { cleared += 1 },
  }
  const cancel = scheduleQuickCutoutPreparationTimeout(() => { timedOut += 1 }, 9000, timers)
  scheduled?.()
  assert.equal(timedOut, 1)
  cancel()
  assert.equal(cleared, 0)

  scheduled = undefined
  const cancelSecond = scheduleQuickCutoutPreparationTimeout(() => { timedOut += 1 }, 9000, timers)
  cancelSecond()
  scheduled?.()
  assert.equal(cleared, 1)
  assert.equal(timedOut, 1)
})

test('toolbar status exposes phase, seconds and terminal result without replacing the app', () => {
  assert.deepEqual(
    formatQuickCutoutButtonStatus({ state: 'idle', message: '' }, 0),
    { label: '快速抠图', title: '快速抠图', busy: false }
  )
  assert.deepEqual(
    formatQuickCutoutButtonStatus({ state: 'working', phase: 'local', message: '本地处理中' }, 4),
    { label: '本地抠图 4s', title: '本地处理中', busy: true }
  )
  assert.equal(formatQuickCutoutButtonStatus({ state: 'working', phase: 'commit', message: '' }, 7).label, '插入画布 7s')
  assert.equal(formatQuickCutoutButtonStatus({ state: 'success', message: '已插入' }, 8).label, '抠图完成')
  assert.equal(formatQuickCutoutButtonStatus({ state: 'error', message: '已停止' }, 9).label, '抠图失败')
})
