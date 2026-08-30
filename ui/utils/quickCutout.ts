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
  backgroundKind: 'transparent' | 'near-white' | 'non-white' | 'scene'
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
  reason?: 'unsupported-background' | 'non-white-background' | 'no-background' | 'mostly-background' | 'invalid-image' | 'image-too-large' | 'subject-background-collision' | 'expected-background-mismatch'
}

const DEFAULTS: Omit<Required<QuickCutoutOptions>, 'expectedBackground'> & { expectedBackground?: [number, number, number] } = {
  tolerance: 42,
  feather: 2,
  minBackgroundConfidence: 0.72,
  maxRemovedRatio: 0.97,
  minRemovedRatio: 0.02,
  expectedBackground: undefined,
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
  // Portraits and product crops often touch the left, right and bottom edges.
  // In that case the median of the entire border describes the subject, not
  // the white backdrop. Prefer a sufficiently represented neutral-light
  // border cluster; flood fill will still verify that it is connected.
  const whiteCandidates = pixels.filter((pixel) => {
    const minimum = Math.min(pixel[0], pixel[1], pixel[2])
    const spread = Math.max(pixel[0], pixel[1], pixel[2]) - minimum
    return minimum >= 205 && spread <= 35
  })
  const sample = whiteCandidates.length >= Math.max(8, pixels.length * 0.08)
    ? whiteCandidates
    : pixels
  const channels = [0, 1, 2].map((channel) => sample.map((pixel) => pixel[channel]))
  const color: [number, number, number] = [
    Math.round(percentile(channels[0], 0.5)),
    Math.round(percentile(channels[1], 0.5)),
    Math.round(percentile(channels[2], 0.5)),
  ]
  const distances = sample.map((pixel) => colorDistance(pixel, [color[0], color[1], color[2], 255]))
  const closeRatio = distances.filter((distance) => distance <= 28).length / distances.length
  const spread = Math.min(1, (percentile(distances, 0.9) || 0) / 90)
  // Confidence measures border uniformity independently from hue. Background
  // classification below decides whether local processing is allowed.
  const confidence = closeRatio * 0.9 + (1 - spread) * 0.1
  return { color, confidence }
}

function classifyBackground(
  color: [number, number, number],
  confidence: number,
  minimumConfidence: number
): QuickCutoutStats['backgroundKind'] {
  if (confidence < minimumConfidence) return 'scene'
  const minimum = Math.min(...color)
  const maximum = Math.max(...color)
  // JPEG compression and studio-white exports commonly land a little below
  // #FFFFFF.  Hue neutrality matters more than requiring every channel to be
  // above 232, otherwise an already-white image is unnecessarily sent to AI.
  return minimum >= 220 && maximum - minimum <= 28 ? 'near-white' : 'non-white'
}

function expectedBackgroundMatches(actual: [number, number, number], expected?: [number, number, number]): boolean {
  if (!expected) return true
  return colorDistance([...actual, 255], [...expected, 255]) <= 105
}

function isNearBackground(pixel: Pixel, background: Pixel, tolerance: number): boolean {
  if (pixel[3] <= 8) return true
  const distance = colorDistance(pixel, background)
  // Preserve strongly saturated pixels even if they happen to be bright.
  const saturationSpread = Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])
  return distance <= tolerance && (saturationSpread < 65 || Math.min(pixel[0], pixel[1], pixel[2]) >= 220 || saturationSpread > 110)
}

function floodBackground(image: ImageData, background: Pixel, tolerance: number): Uint8Array {
  const { width, height, data } = image
  const backgroundMask = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  const enqueue = (x: number, y: number, fromIndex = -1) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return
    const pixelIndex = y * width + x
    if (visited[pixelIndex]) return
    const pixel = getPixel(data, pixelIndex * 4)
    if (!isNearBackground(pixel, background, tolerance)) {
      visited[pixelIndex] = 1
      return
    }
    if (fromIndex >= 0) {
      const from = getPixel(data, fromIndex * 4)
      const localStep = colorDistance(pixel, from)
      const fromBackgroundDistance = colorDistance(from, background)
      const pixelBackgroundDistance = colorDistance(pixel, background)
      // Only stop at an edge that moves distinctly away from the sampled
      // background. The previous implementation stopped at every small JPEG
      // fluctuation and fragmented ordinary white backgrounds, which made the
      // whole local path appear broken. A visible off-white garment boundary
      // still forms a barrier, while background noise can be reached from a
      // smoother neighbouring path.
      if (
        localStep >= Math.max(12, tolerance * 0.26)
        && pixelBackgroundDistance >= fromBackgroundDistance + 8
      ) return
    }
    visited[pixelIndex] = 1
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
    enqueue(x - 1, y, pixelIndex)
    enqueue(x + 1, y, pixelIndex)
    enqueue(x, y - 1, pixelIndex)
    enqueue(x, y + 1, pixelIndex)
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
  for (let index = 0; index < backgroundMask.length; index += 1) {
    if (backgroundMask[index]) continue
    candidateForeground += 1
    const pixel = getPixel(image.data, index * 4)
    const distance = colorDistance(pixel, background)
    const saturationSpread = Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])
    if (distance > tolerance * 1.25 || saturationSpread > 72) {
      sure += 1
      sureMask[index] = 1
    }
  }
  const ratio = sure / Math.max(1, image.width * image.height)
  const candidateRatio = candidateForeground / Math.max(1, image.width * image.height)

  // Analyse connected foreground components instead of one global bounding
  // box. A global span mistakes the ordinary white gap between two people for
  // deleted clothing. Vertically aligned fragments, on the other hand, are a
  // useful safety signal that an indistinguishable white garment was flooded
  // away between a person's upper and lower visible details.
  type Component = { area: number; sure: number; minX: number; maxX: number; minY: number; maxY: number }
  const components: Component[] = []
  const visited = new Uint8Array(backgroundMask.length)
  const queue = new Int32Array(backgroundMask.length)
  for (let start = 0; start < backgroundMask.length; start += 1) {
    if (backgroundMask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    let area = 0
    let sureArea = 0
    let minX = image.width
    let maxX = -1
    let minY = image.height
    let maxY = -1
    visited[start] = 1
    queue[tail++] = start
    while (head < tail) {
      const index = queue[head++]
      const x = index % image.width
      const y = Math.floor(index / image.width)
      area += 1
      sureArea += sureMask[index]
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nextX = x + dx
          const nextY = y + dy
          if (nextX < 0 || nextX >= image.width || nextY < 0 || nextY >= image.height) continue
          const next = nextY * image.width + nextX
          if (backgroundMask[next] || visited[next]) continue
          visited[next] = 1
          queue[tail++] = next
        }
      }
    }
    components.push({ area, sure: sureArea, minX, maxX, minY, maxY })
  }

  const meaningful = components.filter((component) => component.sure > 0 && component.area >= 1)
  let verticallyFragmented = false
  for (let firstIndex = 0; firstIndex < meaningful.length && !verticallyFragmented; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < meaningful.length; secondIndex += 1) {
      const first = meaningful[firstIndex]
      const second = meaningful[secondIndex]
      const upper = first.maxY < second.minY ? first : second.maxY < first.minY ? second : null
      const lower = upper === first ? second : upper === second ? first : null
      if (!upper || !lower) continue
      const verticalGap = lower.minY - upper.maxY - 1
      if (verticalGap < 1 || verticalGap > Math.max(3, image.height * 0.35)) continue
      const overlap = Math.min(upper.maxX, lower.maxX) - Math.max(upper.minX, lower.minX) + 1
      const narrowerWidth = Math.min(upper.maxX - upper.minX + 1, lower.maxX - lower.minX + 1)
      const upperCenter = (upper.minX + upper.maxX) / 2
      const lowerCenter = (lower.minX + lower.maxX) / 2
      const horizontallyAligned = overlap >= Math.max(1, narrowerWidth * 0.25)
        || Math.abs(upperCenter - lowerCenter) <= Math.max(2, narrowerWidth * 0.6)
      if (horizontallyAligned) verticallyFragmented = true
    }
  }

  const collision = candidateRatio > 0.008 && (ratio < 0.012 || verticallyFragmented)
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
      stats: { backgroundKind: 'scene', backgroundColor: [255, 255, 255], backgroundConfidence: 0, removedRatio: 0, touchesForegroundEdge: false, complexBackground: true, edgeBackgroundRatios: EMPTY_EDGE_RATIOS, longestForegroundEdgeRun: 0, subjectBackgroundCollision: false, sureForegroundRatio: 0 },
      reason: 'image-too-large',
    }
  }
  if (invalid) {
    return {
      success: false,
      imageData: image,
      stats: { backgroundKind: 'scene', backgroundColor: [255, 255, 255], backgroundConfidence: 0, removedRatio: 0, touchesForegroundEdge: false, complexBackground: true, edgeBackgroundRatios: EMPTY_EDGE_RATIOS, longestForegroundEdgeRun: 0, subjectBackgroundCollision: false, sureForegroundRatio: 0 },
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
        backgroundKind: 'transparent',
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
  const backgroundKind = classifyBackground(color, confidence, config.minBackgroundConfidence)
  if (!expectedBackgroundMatches(color, config.expectedBackground)) {
    return {
      success: false,
      imageData: image,
      stats: {
        backgroundKind,
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
    backgroundKind,
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
  // A caller-provided background colour is used for AI-generated chroma
  // intermediates. Once the sampled border has been verified against that
  // colour, it is safe to remove a uniform non-white background as well.
  // Without an explicit expectation we stay conservative and only process
  // near-white studio backgrounds locally.
  if (backgroundKind !== 'near-white' && !config.expectedBackground) {
    return { success: false, imageData: image, stats, reason: 'non-white-background' }
  }
  // Edge contact and white/white collisions remain useful diagnostics, but
  // they must not turn this local utility into an AI generation workflow.
  // The edge-connected mask still removes only background reachable from the
  // canvas border and leaves every non-background source pixel untouched.
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
