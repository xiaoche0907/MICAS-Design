/**
 * Lightweight, local background removal for the common AI/product case.
 *
 * The algorithm deliberately only removes pixels that are both similar to the
 * sampled border background and connected to that border. This keeps white
 * fabric, labels and highlights inside the product intact. When the border is
 * not a trustworthy near-white background, callers should keep the original
 * image and send it through their AI workflow instead.
 */

export interface QuickCutoutOptions {
  /** Maximum RGB distance from the estimated border colour. */
  tolerance?: number
  /** Soft transition width around the detected background edge. */
  feather?: number
  /** Minimum confidence required before touching the image. */
  minBackgroundConfidence?: number
  /** Reject images where almost all pixels are classified as background. */
  maxRemovedRatio?: number
  /** Reject images where no meaningful background was found. */
  minRemovedRatio?: number
  /** Expected background RGB; a mismatch safely aborts transparency. */
  expectedBackground?: [number, number, number]
}

export interface QuickCutoutStats {
  backgroundColor: [number, number, number]
  backgroundConfidence: number
  removedRatio: number
  touchesForegroundEdge: boolean
  complexBackground: boolean
  edgeBackgroundRatios: { top: number; right: number; bottom: number; left: number }
  longestForegroundEdgeRun: number
  subjectBackgroundCollision: boolean
  sureForegroundRatio: number
}

export interface QuickCutoutResult {
  success: boolean
  imageData: ImageData
  stats: QuickCutoutStats
  reason?: 'unsupported-background' | 'no-background' | 'mostly-background' | 'invalid-image' | 'image-too-large' | 'subject-background-collision' | 'expected-background-mismatch'
}

const DEFAULTS: Omit<Required<QuickCutoutOptions>, 'expectedBackground'> & { expectedBackground?: [number, number, number] } = {
  tolerance: 42,
  feather: 2,
  minBackgroundConfidence: 0.72,
  maxRemovedRatio: 0.97,
  minRemovedRatio: 0.02,
  expectedBackground: undefined,
}

export type ChromaKeyName = 'green' | 'magenta' | 'blue'

const CHROMA_KEYS: Record<ChromaKeyName, [number, number, number]> = {
  green: [0, 255, 0],
  magenta: [255, 0, 255],
  blue: [0, 96, 255],
}

export function chromaKeyColor(name: ChromaKeyName): [number, number, number] {
  return [...CHROMA_KEYS[name]] as [number, number, number]
}

export function chromaKeyHex(name: ChromaKeyName): string {
  return `#${CHROMA_KEYS[name].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

const EMPTY_EDGE_RATIOS = { top: 0, right: 0, bottom: 0, left: 0 }

type Pixel = [number, number, number, number]

function clamp(value: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, value))
}

function colorDistance(a: Pixel, b: Pixel): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 255
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]
}

function indexOf(x: number, y: number, width: number): number {
  return (y * width + x) * 4
}

function getPixel(data: Uint8ClampedArray, offset: number): Pixel {
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
}

function collectBorderPixels(image: ImageData): Pixel[] {
  const pixels: Pixel[] = []
  const { width, height, data } = image
  const stride = Math.max(1, Math.floor(Math.max(width, height) / 64))
  for (let x = 0; x < width; x += stride) {
    pixels.push(getPixel(data, indexOf(x, 0, width)))
    if (height > 1) pixels.push(getPixel(data, indexOf(x, height - 1, width)))
  }
  for (let y = stride; y < height - 1; y += stride) {
    pixels.push(getPixel(data, indexOf(0, y, width)))
    if (width > 1) pixels.push(getPixel(data, indexOf(width - 1, y, width)))
  }
  return pixels.filter((pixel) => pixel[3] > 8)
}

function meaningfulAlpha(image: ImageData): { transparentRatio: number; visibleRatio: number } {
  let transparent = 0
  let visible = 0
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] < 250) transparent += 1
    if (image.data[offset] > 8) visible += 1
  }
  const total = image.width * image.height
  return { transparentRatio: transparent / total, visibleRatio: visible / total }
}

function estimateBackground(pixels: Pixel[]): { color: [number, number, number]; confidence: number } {
  if (!pixels.length) return { color: [255, 255, 255], confidence: 0 }
  const channels = [0, 1, 2].map((channel) => pixels.map((pixel) => pixel[channel]))
  const color: [number, number, number] = [
    Math.round(percentile(channels[0], 0.5)),
    Math.round(percentile(channels[1], 0.5)),
    Math.round(percentile(channels[2], 0.5)),
  ]
  const distances = pixels.map((pixel) => colorDistance(pixel, [color[0], color[1], color[2], 255]))
  const closeRatio = distances.filter((distance) => distance <= 28).length / distances.length
  const spread = Math.min(1, (percentile(distances, 0.9) || 0) / 90)
  // Background confidence is colour agnostic: a uniform green/blue/magenta
  // screen is just as trustworthy as a uniform white background.
  const confidence = closeRatio * 0.9 + (1 - spread) * 0.1
  return { color, confidence }
}

/** Select a chroma-key colour only when it is actually present on the border. */
export function chooseChromaKey(image: ImageData): ChromaKeyName | null {
  const border = collectBorderPixels(image)
  if (!border.length) return null
  const estimated = estimateBackground(border)
  const interior: Pixel[] = []
  const stride = Math.max(1, Math.floor(Math.max(image.width, image.height) / 64))
  for (let y = stride; y < image.height - stride; y += stride) {
    for (let x = stride; x < image.width - stride; x += stride) {
      const pixel = getPixel(image.data, indexOf(x, y, image.width))
      if (!isNearBackground(pixel, [...estimated.color, 255], 42)) interior.push(pixel)
    }
  }
  const subject = interior.length ? interior : border
  const scored = (Object.keys(CHROMA_KEYS) as ChromaKeyName[]).map((name) => {
    const key = [...CHROMA_KEYS[name], 255] as Pixel
    const distances = subject.map((pixel) => colorDistance(pixel, key)).sort((a, b) => a - b)
    const p10 = distances[Math.floor((distances.length - 1) * 0.1)] || 0
    const nearRatio = distances.filter((distance) => distance < 105).length / distances.length
    return { name, score: p10 + (1 - nearRatio) * 90 }
  }).sort((a, b) => b.score - a.score)
  const best = scored[0]
  return best?.name || 'green'
}

function expectedBackgroundMatches(actual: [number, number, number], expected?: [number, number, number]): boolean {
  if (!expected) return true
  return colorDistance([...actual, 255], [...expected, 255]) <= 105
}

function isNearBackground(pixel: Pixel, background: Pixel, tolerance: number): boolean {
  if (pixel[3] <= 8) return true
  const distance = colorDistance(pixel, background)
  // Preserve strong chromatic pixels even if they happen to be bright.
  const chroma = Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])
  return distance <= tolerance && (chroma < 65 || Math.min(pixel[0], pixel[1], pixel[2]) >= 220 || chroma > 110)
}

function floodBackground(image: ImageData, background: Pixel, tolerance: number): Uint8Array {
  const { width, height, data } = image
  const backgroundMask = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  const enqueue = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return
    const pixelIndex = y * width + x
    if (visited[pixelIndex]) return
    visited[pixelIndex] = 1
    const pixel = getPixel(data, pixelIndex * 4)
    if (!isNearBackground(pixel, background, tolerance)) return
    backgroundMask[pixelIndex] = 1
    queue[tail++] = pixelIndex
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  while (head < tail) {
    const pixelIndex = queue[head++]
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    enqueue(x - 1, y)
    enqueue(x + 1, y)
    enqueue(x, y - 1)
    enqueue(x, y + 1)
  }
  return backgroundMask
}

function analyzeEdges(mask: Uint8Array, width: number, height: number): {
  ratios: { top: number; right: number; bottom: number; left: number }
  longestForegroundEdgeRun: number
  touchesForegroundEdge: boolean
  severeContactCount: number
} {
  const edges = [
    Array.from({ length: width }, (_, x) => Boolean(mask[x])),
    Array.from({ length: height }, (_, y) => Boolean(mask[y * width + width - 1])),
    Array.from({ length: width }, (_, x) => Boolean(mask[(height - 1) * width + x])),
    Array.from({ length: height }, (_, y) => Boolean(mask[y * width])),
  ]
  const names: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left']
  const ratios = {} as { top: number; right: number; bottom: number; left: number }
  let longestForegroundEdgeRun = 0
  let severeContactCount = 0
  edges.forEach((edge, index) => {
    const backgroundRatio = edge.filter(Boolean).length / Math.max(1, edge.length)
    ratios[names[index]] = backgroundRatio
    let current = 0
    let longest = 0
    edge.forEach((isBackground) => {
      current = isBackground ? 0 : current + 1
      longest = Math.max(longest, current)
    })
    longestForegroundEdgeRun = Math.max(longestForegroundEdgeRun, longest)
    if (1 - backgroundRatio >= 0.35 && longest >= Math.max(3, edge.length * 0.1)) severeContactCount += 1
  })
  return {
    ratios,
    longestForegroundEdgeRun,
    touchesForegroundEdge: edges.some((edge) => edge.some((isBackground) => !isBackground)),
    severeContactCount,
  }
}

function foregroundDistance(mask: Uint8Array, width: number, height: number, limit: number): Uint16Array {
  const distances = new Uint16Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (!mask[index]) continue
      let adjacent = false
      for (let dy = -1; dy <= 1 && !adjacent; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && !mask[ny * width + nx]) {
            adjacent = true
            break
          }
        }
      }
      if (adjacent) {
        distances[index] = 1
        queue[tail++] = index
      }
    }
  }
  while (head < tail) {
    const index = queue[head++]
    const distance = distances[index]
    if (distance >= limit) continue
    const x = index % width
    const y = Math.floor(index / width)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || (dx === 0 && dy === 0)) continue
        const next = ny * width + nx
        if (mask[next] && distances[next] === 0) {
          distances[next] = distance + 1
          queue[tail++] = next
        }
      }
    }
  }
  return distances
}

function inspectSureForeground(
  image: ImageData,
  background: Pixel,
  backgroundMask: Uint8Array,
  tolerance: number
): { ratio: number; collision: boolean } {
  let sure = 0
  let candidateForeground = 0
  const sureMask = new Uint8Array(image.width * image.height)
  const rowMin = new Int32Array(image.height)
  const rowMax = new Int32Array(image.height)
  const columnMin = new Int32Array(image.width)
  const columnMax = new Int32Array(image.width)
  rowMin.fill(image.width)
  columnMin.fill(image.height)
  rowMax.fill(-1)
  columnMax.fill(-1)
  for (let index = 0; index < backgroundMask.length; index += 1) {
    if (backgroundMask[index]) continue
    candidateForeground += 1
    const pixel = getPixel(image.data, index * 4)
    const distance = colorDistance(pixel, background)
    const chroma = Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])
    if (distance > tolerance * 1.25 || chroma > 72) {
      sure += 1
      const x = index % image.width
      const y = Math.floor(index / image.width)
      sureMask[index] = 1
      rowMin[y] = Math.min(rowMin[y], x)
      rowMax[y] = Math.max(rowMax[y], x)
      columnMin[x] = Math.min(columnMin[x], y)
      columnMax[x] = Math.max(columnMax[x], y)
    }
  }
  const ratio = sure / Math.max(1, image.width * image.height)
  const candidateRatio = candidateForeground / Math.max(1, image.width * image.height)
  let intrusionRatio = 0
  let maxIntrusionRun = 0
  let intrusionCount = 0
  if (sure > 0) {
    // Use the actual horizontal and vertical spans of sure foreground rather
    // than its rectangular bounding box.  A narrow head over broad shoulders
    // must not make the ordinary background between the silhouette and the
    // bbox look like an internal hole.
    const spanMask = new Uint8Array(image.width * image.height)
    let spanArea = 0
    for (let y = 0; y < image.height; y += 1) {
      if (rowMax[y] < rowMin[y]) continue
      for (let x = rowMin[y]; x <= rowMax[y]; x += 1) {
        const index = y * image.width + x
        if (!spanMask[index]) {
          spanMask[index] = 1
          spanArea += 1
        }
      }
    }
    for (let x = 0; x < image.width; x += 1) {
      if (columnMax[x] < columnMin[x]) continue
      for (let y = columnMin[x]; y <= columnMax[x]; y += 1) {
        const index = y * image.width + x
        if (!spanMask[index]) {
          spanMask[index] = 1
          spanArea += 1
        }
      }
    }

    const intrusion = new Uint8Array(image.width * image.height)
    for (let y = 0; y < image.height; y += 1) {
      let rowRun = 0
      for (let x = 0; x < image.width; x += 1) {
        const index = y * image.width + x
        if (spanMask[index] && backgroundMask[index]) {
          intrusion[index] = 1
          intrusionCount += 1
          rowRun += 1
          maxIntrusionRun = Math.max(maxIntrusionRun, rowRun)
        } else {
          rowRun = 0
        }
      }
    }
    for (let x = 0; x < image.width; x += 1) {
      let columnRun = 0
      for (let y = 0; y < image.height; y += 1) {
        if (intrusion[y * image.width + x]) {
          columnRun += 1
          maxIntrusionRun = Math.max(maxIntrusionRun, columnRun)
        } else {
          columnRun = 0
        }
      }
    }
    intrusionRatio = intrusionCount / Math.max(1, spanArea)
  }
  // If nearly all of the plausible subject has the same colour as the
  // background, deleting it would destroy a white garment or a highlight.
  // Require a sizeable internal block as well as a meaningful span ratio so
  // one-pixel anti-aliased gaps do not reject normal silhouettes.
  const spanCollision = (intrusionRatio >= 0.16 && intrusionCount >= 6)
    || (maxIntrusionRun >= 5 && intrusionCount >= 8)
    // A mostly white garment can leave only a small vertical gap between a
    // dark button/skin/hair sure-foreground island and the flooded background.
    // Treat that compact gap as a collision when the sure subject is sparse;
    // ordinary anti-aliasing is at most a single pixel and does not qualify.
    || (ratio < 0.2 && maxIntrusionRun >= 2 && intrusionCount >= 2)
  const collision = candidateRatio > 0.008 && (ratio < 0.012 || spanCollision)
  return { ratio, collision }
}

/** Apply an edge-aware alpha change to an ImageData object. */
export function quickCutout(image: ImageData, options: QuickCutoutOptions = {}): QuickCutoutResult {
  const config = { ...DEFAULTS, ...options }
  const invalid = !image || image.width < 2 || image.height < 2 || image.data.length < image.width * image.height * 4
  if (!invalid && Math.max(image.width, image.height) > 2048) {
    return {
      success: false,
      imageData: image,
      stats: { backgroundColor: [255, 255, 255], backgroundConfidence: 0, removedRatio: 0, touchesForegroundEdge: false, complexBackground: true, edgeBackgroundRatios: EMPTY_EDGE_RATIOS, longestForegroundEdgeRun: 0, subjectBackgroundCollision: false, sureForegroundRatio: 0 },
      reason: 'image-too-large',
    }
  }
  if (invalid) {
    return {
      success: false,
      imageData: image,
      stats: { backgroundColor: [255, 255, 255], backgroundConfidence: 0, removedRatio: 0, touchesForegroundEdge: false, complexBackground: true, edgeBackgroundRatios: EMPTY_EDGE_RATIOS, longestForegroundEdgeRun: 0, subjectBackgroundCollision: false, sureForegroundRatio: 0 },
      reason: 'invalid-image',
    }
  }

  const alpha = meaningfulAlpha(image)
  if (alpha.transparentRatio >= 0.02 && alpha.visibleRatio >= 0.02) {
    const preserved = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height)
    return {
      success: true,
      imageData: preserved,
      stats: {
        backgroundColor: [255, 255, 255],
        backgroundConfidence: 1,
        removedRatio: alpha.transparentRatio,
        touchesForegroundEdge: false,
        complexBackground: false,
        edgeBackgroundRatios: EMPTY_EDGE_RATIOS,
        longestForegroundEdgeRun: 0,
        subjectBackgroundCollision: false,
        sureForegroundRatio: 1 - alpha.transparentRatio,
      },
    }
  }

  const { color, confidence } = estimateBackground(collectBorderPixels(image))
  if (!expectedBackgroundMatches(color, config.expectedBackground)) {
    return {
      success: false,
      imageData: image,
      stats: {
        backgroundColor: color,
        backgroundConfidence: confidence,
        removedRatio: 0,
        touchesForegroundEdge: false,
        complexBackground: true,
        edgeBackgroundRatios: { top: 0, right: 0, bottom: 0, left: 0 },
        longestForegroundEdgeRun: 0,
        subjectBackgroundCollision: false,
        sureForegroundRatio: 0,
      },
      reason: 'expected-background-mismatch',
    }
  }
  const background = [color[0], color[1], color[2], 255] as Pixel
  const adaptiveTolerance = clamp(config.tolerance * (0.82 + confidence * 0.35), 24, 64)
  const backgroundMask = floodBackground(image, background, adaptiveTolerance)
  let removed = 0
  for (let i = 0; i < backgroundMask.length; i += 1) removed += backgroundMask[i]
  const removedRatio = removed / backgroundMask.length
  const edgeAnalysis = analyzeEdges(backgroundMask, image.width, image.height)
  const sureForeground = inspectSureForeground(image, background, backgroundMask, adaptiveTolerance)
  const stats: QuickCutoutStats = {
    backgroundColor: color,
    backgroundConfidence: confidence,
    removedRatio,
    touchesForegroundEdge: edgeAnalysis.touchesForegroundEdge,
    complexBackground: confidence < config.minBackgroundConfidence,
    edgeBackgroundRatios: edgeAnalysis.ratios,
    longestForegroundEdgeRun: edgeAnalysis.longestForegroundEdgeRun,
    subjectBackgroundCollision: sureForeground.collision,
    sureForegroundRatio: sureForeground.ratio,
  }

  if (confidence < config.minBackgroundConfidence) {
    return { success: false, imageData: image, stats, reason: 'unsupported-background' }
  }
  // A subject touching the canvas edge has no reliable outside/background
  // boundary. Returning the source lets the caller route it to AI instead of
  // risking a clipped product.
  if (edgeAnalysis.severeContactCount >= 2) {
    return { success: false, imageData: image, stats, reason: 'unsupported-background' }
  }
  if (sureForeground.collision) {
    return { success: false, imageData: image, stats, reason: 'subject-background-collision' }
  }
  if (removedRatio < config.minRemovedRatio) {
    return { success: false, imageData: image, stats, reason: 'no-background' }
  }
  if (removedRatio > config.maxRemovedRatio) {
    return { success: false, imageData: image, stats, reason: 'mostly-background' }
  }

  const output = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height)
  const featherDistance = Math.max(1, config.feather)
  const distances = foregroundDistance(backgroundMask, image.width, image.height, featherDistance)
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixelIndex = y * image.width + x
      const offset = pixelIndex * 4
      if (!backgroundMask[pixelIndex]) continue

      // A bounded breadth-first distance gives a soft transition without a
      // quadratic search for every background pixel.
      const nearest = distances[pixelIndex] || featherDistance + 1
      const alpha = nearest <= featherDistance
        ? Math.round(clamp((1 - nearest / featherDistance) * 255, 0, 255))
        : 0
      output.data[offset + 3] = Math.min(output.data[offset + 3], alpha)
      // Remove white contamination only as the pixel becomes transparent; fully
      // opaque pixels and original alpha values remain untouched.
      if (alpha > 0) {
        const factor = alpha / 255
        output.data[offset] = Math.round(clamp((output.data[offset] - color[0] * (1 - factor)) / Math.max(0.08, factor)))
        output.data[offset + 1] = Math.round(clamp((output.data[offset + 1] - color[1] * (1 - factor)) / Math.max(0.08, factor)))
        output.data[offset + 2] = Math.round(clamp((output.data[offset + 2] - color[2] * (1 - factor)) / Math.max(0.08, factor)))
      } else {
        output.data[offset] = 0
        output.data[offset + 1] = 0
        output.data[offset + 2] = 0
      }
    }
  }
  return { success: true, imageData: output, stats }
}
