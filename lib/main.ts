import {
  PluginMessage,
  UIMessage,
  UIMessageData,
  sendMsgToUI,
  SelectionPayload,
  LayerSummary,
  ApiProfile,
  InsertImagePayload,
  InsertImagesPayload,
  InsertImageGridPayload,
  ExportedImagePayload,
} from '@messages/sender'

// MasterGo supports one plugin UI window, so keep the main panel fixed.
mg.showUI(__html__, {
  width: 420,
  height: 820,
})

const CLIENT_STORAGE_KEY = 'micas_api_profile_v1'
const GENERATION_HISTORY_KEY = 'micas_generation_history_v1'
const PROMPT_LIBRARY_KEY = 'micas_prompt_library_v1'
const PANEL_SIZE = { width: 420, height: 820 }
// Height includes enough room for MasterGo's native title bar plus the 50px toolbar.
const IMAGE_MENU_SIZE = { width: 720, height: 94 }
const OUTPAINT_SIZE = { width: 700, height: 720 }
const TRY_ON_SIZE = { width: 760, height: 720 }
const GENERATING_SIZE = { width: 320, height: 94 }
let currentUiMode: 'panel' | 'image-menu' | 'outpaint' | 'tryon' | 'generating' = 'panel'
let panelPosition: { x: number; y: number } | null = null
let anchoredImageNodeId: string | null = null
let anchorTimer: ReturnType<typeof setInterval> | null = null
let lastMenuPosition: { x: number; y: number } | null = null

function nodeHasImageFill(node: any): boolean {
  const fills = Array.isArray(node?.fills) ? node.fills : []
  return fills.some((fill: any) => fill?.type === 'IMAGE')
}

/**
 * 获取当前选区节点基本数据
 */
function getSelectionPayload(): SelectionPayload {
  const selection = mg.document.currentPage.selection || []
  const layers: LayerSummary[] = selection.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    width: 'width' in node ? (node as any).width : undefined,
    height: 'height' in node ? (node as any).height : undefined,
    isImage: nodeHasImageFill(node),
  }))
  return {
    count: selection.length,
    layers,
  }
}

function positionImageMenu(node: any) {
  const box = node.absoluteBoundingBox || node
  const canvas = mg.viewport.positionOnDom
  const visible = mg.viewport.bound
  const zoom = mg.viewport.zoom || 1
  const nodeLeft = canvas.x + ((box.x || 0) - visible.x) * zoom
  const nodeRight = nodeLeft + (box.width || 0) * zoom
  const nodeTop = canvas.y + ((box.y || 0) - visible.y) * zoom
  const nodeBottom = nodeTop + (box.height || 0) * zoom
  const minX = canvas.x + 8
  const maxX = canvas.x + canvas.width - IMAGE_MENU_SIZE.width - 8
  const minY = canvas.y + 8
  const maxY = canvas.y + canvas.height - IMAGE_MENU_SIZE.height - 8
  const edgeGap = 10
  const centeredX = nodeLeft + (nodeRight - nodeLeft - IMAGE_MENU_SIZE.width) / 2
  const x = Math.min(Math.max(minX, centeredX), Math.max(minX, maxX))
  const belowY = nodeBottom + edgeGap
  const aboveY = nodeTop - IMAGE_MENU_SIZE.height - edgeGap
  const y = belowY <= maxY
    ? belowY
    : Math.max(minY, aboveY)

  const nextPosition = { x: Math.round(x), y: Math.round(y) }
  if (!lastMenuPosition || lastMenuPosition.x !== nextPosition.x || lastMenuPosition.y !== nextPosition.y) {
    mg.ui.moveTo(nextPosition.x, nextPosition.y)
    lastMenuPosition = nextPosition
  }
}

function stopImageMenuTracking() {
  if (anchorTimer !== null) clearInterval(anchorTimer)
  anchorTimer = null
  anchoredImageNodeId = null
  lastMenuPosition = null
}

function startImageMenuTracking(node: any) {
  anchoredImageNodeId = node.id
  positionImageMenu(node)
  if (anchorTimer !== null) clearInterval(anchorTimer)
  anchorTimer = setInterval(() => {
    if (currentUiMode !== 'image-menu' || !anchoredImageNodeId) return
    const anchoredNode = mg.getNodeById(anchoredImageNodeId) as any
    if (anchoredNode) positionImageMenu(anchoredNode)
  }, 80)
}

function setUiMode(mode: 'panel' | 'image-menu' | 'outpaint' | 'tryon' | 'generating') {
  if (mode === 'panel') {
    stopImageMenuTracking()
    mg.ui.resize(PANEL_SIZE.width, PANEL_SIZE.height)
    if (panelPosition) mg.ui.moveTo(panelPosition.x, panelPosition.y)
    currentUiMode = 'panel'
    return
  }

  if (mode === 'outpaint') {
    stopImageMenuTracking()
    mg.ui.resize(OUTPAINT_SIZE.width, OUTPAINT_SIZE.height)
    const canvas = mg.viewport.positionOnDom
    const x = canvas.x + Math.max(8, (canvas.width - OUTPAINT_SIZE.width) / 2)
    const y = canvas.y + Math.max(8, (canvas.height - OUTPAINT_SIZE.height) / 2)
    mg.ui.moveTo(Math.round(x), Math.round(y))
    currentUiMode = 'outpaint'
    return
  }

  if (mode === 'tryon') {
    stopImageMenuTracking()
    mg.ui.resize(TRY_ON_SIZE.width, TRY_ON_SIZE.height)
    const canvas = mg.viewport.positionOnDom
    const x = canvas.x + Math.max(8, (canvas.width - TRY_ON_SIZE.width) / 2)
    const y = canvas.y + Math.max(8, (canvas.height - TRY_ON_SIZE.height) / 2)
    mg.ui.moveTo(Math.round(x), Math.round(y))
    currentUiMode = 'tryon'
    return
  }

  if (mode === 'generating') {
    stopImageMenuTracking()
    mg.ui.resize(GENERATING_SIZE.width, GENERATING_SIZE.height)
    const canvas = mg.viewport.positionOnDom
    const x = canvas.x + Math.max(8, canvas.width - GENERATING_SIZE.width - 24)
    const y = canvas.y + 24
    mg.ui.moveTo(Math.round(x), Math.round(y))
    currentUiMode = 'generating'
    return
  }

  const selection = mg.document.currentPage.selection || []
  const node = selection.length === 1 ? selection[0] as any : null
  if (!node || !nodeHasImageFill(node)) return

  if (currentUiMode === 'panel') {
    const uiViewport = mg.ui.viewport
    panelPosition = { x: uiViewport.x, y: uiViewport.y }
  }

  mg.ui.resize(IMAGE_MENU_SIZE.width, IMAGE_MENU_SIZE.height)
  currentUiMode = 'image-menu'
  startImageMenuTracking(node)
}

/**
 * 广播选区变更通知到 UI
 */
function broadcastSelection() {
  sendMsgToUI({
    type: PluginMessage.SELECTION_CHANGED,
    payload: getSelectionPayload(),
  })
}

/**
 * 高性能适屏导出选中的图层为 PNG 字节流数据
 */
async function exportSelectionImages(maxDimension = 1024) {
  const selection = mg.document.currentPage.selection || []
  if (selection.length === 0) {
    sendMsgToUI({
      type: PluginMessage.TOAST,
      payload: { message: '请先在 MasterGo 画布中选择至少一个图层', messageType: 'warning' },
    })
    return
  }

  const exportedImages: ExportedImagePayload[] = []

  for (const node of selection) {
    try {
      const width = 'width' in node ? (node as any).width || 512 : 512
      const height = 'height' in node ? (node as any).height || 512 : 512
      const maxDim = Math.max(width, height)

      // 普通参考图限制尺寸；裁切功能可请求更高分辨率以保留细节。
      const safeMaxDimension = Math.min(Math.max(maxDimension, 256), 4096)
      let scale = 1.0
      if (maxDim > safeMaxDimension) {
        scale = safeMaxDimension / maxDim
      }

      // 使用 constraint 导出受控尺寸的轻量级 PNG
      const exportOptions: ExportSettings = {
        format: 'PNG',
        constraint: {
          type: 'SCALE',
          value: scale,
        },
      }

      const exportResult = await node.exportAsync(exportOptions)
      const bytes: Uint8Array =
        typeof exportResult === 'string'
          ? new TextEncoder().encode(exportResult)
          : exportResult

      exportedImages.push({
        id: node.id,
        name: node.name,
        bytes,
        mimeType: 'image/png',
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      })
    } catch (err) {
      console.error(`导出节点 ${node.name} 失败:`, err)
    }
  }

  sendMsgToUI({
    type: PluginMessage.SELECTION_IMAGE_EXPORTED,
    payload: exportedImages,
  })
}

/**
 * 从 clientStorage 获取 API Profile
 */
async function loadApiProfile() {
  try {
    const jsonStr = await mg.clientStorage.getAsync(CLIENT_STORAGE_KEY)
    if (jsonStr) {
      const profile: ApiProfile = JSON.parse(jsonStr)
      sendMsgToUI({
        type: PluginMessage.API_PROFILE_LOADED,
        payload: profile,
      })
    } else {
      sendMsgToUI({
        type: PluginMessage.API_PROFILE_LOADED,
        payload: null,
      })
    }
  } catch (err) {
    console.error('读取 API Profile 失败:', err)
    sendMsgToUI({
      type: PluginMessage.API_PROFILE_LOADED,
      payload: null,
    })
  }
}

/**
 * 保存 API Profile 到 clientStorage
 */
async function saveApiProfile(profile: ApiProfile) {
  try {
    await mg.clientStorage.setAsync(CLIENT_STORAGE_KEY, JSON.stringify(profile))
    sendMsgToUI({
      type: PluginMessage.API_PROFILE_SAVED,
      payload: { success: true },
    })
    sendMsgToUI({
      type: PluginMessage.TOAST,
      payload: { message: 'API 配置已成功保存！', messageType: 'success' },
    })
  } catch (err) {
    console.error('保存 API Profile 失败:', err)
    sendMsgToUI({
      type: PluginMessage.ERROR,
      payload: { message: '保存 API 配置失败' },
    })
  }
}

async function loadGenerationHistory() {
  try {
    const raw = await mg.clientStorage.getAsync(GENERATION_HISTORY_KEY)
    const history = raw ? JSON.parse(raw) : []
    sendMsgToUI({
      type: PluginMessage.GENERATION_HISTORY_LOADED,
      payload: Array.isArray(history) ? history : [],
    })
  } catch (err) {
    console.error('读取生成历史失败:', err)
    sendMsgToUI({ type: PluginMessage.GENERATION_HISTORY_LOADED, payload: [] })
  }
}

async function saveGenerationHistory(history: any[]) {
  try {
    await mg.clientStorage.setAsync(
      GENERATION_HISTORY_KEY,
      JSON.stringify(Array.isArray(history) ? history.slice(0, 20) : [])
    )
  } catch (err) {
    console.error('保存生成历史失败:', err)
    sendMsgToUI({
      type: PluginMessage.TOAST,
      payload: { message: '生成成功，但历史记录保存失败', messageType: 'warning' },
    })
  }
}

async function loadPromptLibrary() {
  try {
    const raw = await mg.clientStorage.getAsync(PROMPT_LIBRARY_KEY)
    const library = raw ? JSON.parse(raw) : []
    sendMsgToUI({
      type: PluginMessage.PROMPT_LIBRARY_LOADED,
      payload: Array.isArray(library) ? library : [],
    })
  } catch (err) {
    console.error('读取提示词库失败:', err)
    sendMsgToUI({ type: PluginMessage.PROMPT_LIBRARY_LOADED, payload: [] })
  }
}

async function savePromptLibrary(library: any[]) {
  try {
    await mg.clientStorage.setAsync(
      PROMPT_LIBRARY_KEY,
      JSON.stringify(Array.isArray(library) ? library.slice(0, 100) : [])
    )
  } catch (err) {
    console.error('保存提示词库失败:', err)
    sendMsgToUI({
      type: PluginMessage.TOAST,
      payload: { message: '提示词库保存失败，请重试', messageType: 'error' },
    })
  }
}

function normalizeImageBytes(value: any): Uint8Array {
  if (!value) return new Uint8Array()
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return Uint8Array.from(value)
  if (Array.isArray(value.data)) return Uint8Array.from(value.data)
  if (value.buffer instanceof ArrayBuffer) {
    return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength || value.buffer.byteLength)
  }
  if (typeof value === 'object') {
    const numericValues = Object.keys(value)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key])
    if (numericValues.length) return Uint8Array.from(numericValues)
  }
  return new Uint8Array()
}

function readImageDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  if (bytes.length < 10) return {}
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // PNG IHDR
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16, false), height: view.getUint32(20, false) }
  }

  // JPEG SOF markers
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1
        continue
      }
      const marker = bytes[offset + 1]
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2
        continue
      }
      const segmentLength = view.getUint16(offset + 2, false)
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
      if (isSof && offset + 8 < bytes.length) {
        return {
          height: view.getUint16(offset + 5, false),
          width: view.getUint16(offset + 7, false),
        }
      }
      if (segmentLength < 2) break
      offset += segmentLength + 2
    }
  }

  // GIF logical screen size
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }

  // WebP VP8X / VP8 / VP8L
  if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8X') {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
      return { width, height }
    }
    if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
  }
  return {}
}

async function resolveImageBytes(payload: InsertImagePayload): Promise<Uint8Array> {
  const postedBytes = normalizeImageBytes(payload.bytes)
  if (postedBytes.length) return postedBytes

  const urls = [payload.sourceUrl, payload.proxyUrl].filter(Boolean) as string[]
  let lastError = ''
  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length) return bytes
    } catch (err: any) {
      lastError = err?.message || String(err)
    }
  }
  throw new Error(lastError ? `无法下载生成图片: ${lastError}` : '无效的图片字节数据')
}

/**
 * 将生成图片插回 MasterGo 画布
 */
async function insertImageToCanvas(payload: InsertImagePayload) {
  try {
    const imageBytes = await resolveImageBytes(payload)
    const intrinsicSize = readImageDimensions(imageBytes)
    const imageNode = await mg.createImage(imageBytes)
    if (!imageNode?.href) throw new Error('MasterGo 未返回有效的图片 href')
    const rect = mg.createRectangle()
    rect.name = payload.name || 'MICAS AI 生成图像'

    const w = Math.max(1, Math.round(payload.width || intrinsicSize.width || 1024))
    const h = Math.max(1, Math.round(payload.height || intrinsicSize.height || 1024))

    rect.resize(w, h)

    rect.fills = [
      {
        type: 'IMAGE',
        imageRef: imageNode.href,
        scaleMode: 'FILL',
      },
    ]

    const selection = mg.document.currentPage.selection || []
    if (selection.length > 0) {
      const target = selection[0] as any
      const bounds = target.absoluteBoundingBox || target
      rect.x = (bounds.x || 0) + (bounds.width || 0) + 40
      rect.y = bounds.y || 0
    } else {
      const center = mg.viewport.center
      rect.x = center.x - w / 2
      rect.y = center.y - h / 2
    }

    mg.document.currentPage.appendChild(rect)
    mg.document.currentPage.selection = [rect]
    mg.viewport.scrollAndZoomIntoView([rect])

    sendMsgToUI({
      type: PluginMessage.IMAGE_INSERTED,
      payload: { success: true },
    })
    sendMsgToUI({
      type: PluginMessage.TOAST,
      payload: { message: '已成功将 AI 生成图像插入 MasterGo 画布！', messageType: 'success' },
    })
  } catch (err: any) {
    console.error('插入图片到画布失败:', err)
    sendMsgToUI({
      type: PluginMessage.ERROR,
      payload: { message: `插图失败: ${err?.message || '未知错误'}` },
    })
  }
}

/**
 * Insert generated images one by one. Waiting for each insertion is important:
 * the previous image becomes the current selection, so the next image is placed
 * beside it instead of overlapping it.
 */
async function insertImagesToCanvas(payload: InsertImagesPayload) {
  for (const image of payload.images) {
    await insertImageToCanvas(image)
  }
}

/**
 * Insert cropped tiles beside the source image while preserving the source.
 * Every tile is an independent rectangle so it can be moved or edited alone.
 */
async function insertImageGridToCanvas(payload: InsertImageGridPayload) {
  try {
    const columns = Math.max(1, Math.round(payload.columns || 3))
    const rows = Math.max(1, Math.round(payload.rows || 3))
    const gap = Math.max(0, payload.gap || 0)
    const sourceNode = mg.getNodeById(payload.sourceNodeId) as any
    const sourceBounds = sourceNode?.absoluteBoundingBox || sourceNode
    const sourceWidth = Math.max(1, sourceBounds?.width || 900)
    const sourceHeight = Math.max(1, sourceBounds?.height || 900)
    const tileWidth = sourceWidth / columns
    const tileHeight = sourceHeight / rows
    const center = mg.viewport.center
    const startX = sourceBounds
      ? (sourceBounds.x || 0) + sourceWidth + 40
      : center.x - sourceWidth / 2
    const startY = sourceBounds
      ? sourceBounds.y || 0
      : center.y - sourceHeight / 2
    const tiles: any[] = []

    for (let index = 0; index < payload.images.length; index += 1) {
      const image = payload.images[index]
      const imageBytes = await resolveImageBytes(image)
      const imageNode = await mg.createImage(imageBytes)
      if (!imageNode?.href) throw new Error(`第 ${index + 1} 张裁切图创建失败`)

      const row = Math.floor(index / columns)
      const column = index % columns
      const rect = mg.createRectangle()
      rect.name = image.name || `九宫格裁切 ${row + 1}-${column + 1}`
      rect.resize(tileWidth, tileHeight)
      rect.x = startX + column * (tileWidth + gap)
      rect.y = startY + row * (tileHeight + gap)
      rect.fills = [{ type: 'IMAGE', imageRef: imageNode.href, scaleMode: 'FILL' }]
      mg.document.currentPage.appendChild(rect)
      tiles.push(rect)
    }

    mg.document.currentPage.selection = tiles
    mg.viewport.scrollAndZoomIntoView(tiles)
    sendMsgToUI({ type: PluginMessage.IMAGE_INSERTED, payload: { success: true } })
    sendMsgToUI({
      type: PluginMessage.TOAST,
      payload: { message: '九宫格裁切完成，已生成 9 个独立图层', messageType: 'success' },
    })
  } catch (err: any) {
    console.error('九宫格裁切插入失败:', err)
    sendMsgToUI({
      type: PluginMessage.ERROR,
      payload: { message: `九宫格裁切失败: ${err?.message || '未知错误'}` },
    })
  }
}

// 监听选区改变
mg.on('selectionchange', () => {
  broadcastSelection()
})

// 监听 UI 消息
mg.ui.onmessage = (msgReceived: any) => {
  const msg: UIMessageData = msgReceived?.pluginMessage || msgReceived
  if (!msg || !msg.type) return

  switch (msg.type) {
    case UIMessage.PING:
      sendMsgToUI({ type: PluginMessage.PONG })
      break

    case UIMessage.GET_SELECTION:
      broadcastSelection()
      break

    case UIMessage.EXPORT_SELECTION_IMAGE:
      exportSelectionImages(msg.payload?.maxDimension)
      break

    case UIMessage.GET_API_PROFILE:
      loadApiProfile()
      break

    case UIMessage.SAVE_API_PROFILE:
      saveApiProfile(msg.payload)
      break

    case UIMessage.INSERT_IMAGE:
      insertImageToCanvas(msg.payload)
      break

    case UIMessage.INSERT_IMAGES:
      insertImagesToCanvas(msg.payload)
      break

    case UIMessage.INSERT_IMAGE_GRID:
      insertImageGridToCanvas(msg.payload)
      break

    case UIMessage.SET_UI_MODE:
      setUiMode(msg.payload.mode)
      break

    case UIMessage.GET_GENERATION_HISTORY:
      loadGenerationHistory()
      break

    case UIMessage.SAVE_GENERATION_HISTORY:
      saveGenerationHistory(msg.payload)
      break

    case UIMessage.GET_PROMPT_LIBRARY:
      loadPromptLibrary()
      break

    case UIMessage.SAVE_PROMPT_LIBRARY:
      savePromptLibrary(msg.payload)
      break

    default:
      break
  }
}

sendMsgToUI({ type: PluginMessage.CONNECTED })
broadcastSelection()
loadApiProfile()
loadGenerationHistory()
loadPromptLibrary()
