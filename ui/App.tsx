import React, { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'
import {
  sendMsgToPlugin,
  UIMessage,
  PluginMessage,
  PluginMessageData,
  ApiProfile,
  ExportedImagePayload,
  InsertImagePayload,
  LayerSummary,
  GenerationHistoryItem,
  PromptLibraryItem,
} from '@messages/sender'
import {
  ReferenceImage,
  ReferenceRole,
  GenerationRequest,
  GeneratedImage,
} from './engine/types'
import {
  DEFAULT_MODEL_ID,
  ExtendedModelDefinition,
  getModelById,
  getModelsForProfile,
} from './engine/modelRegistry'
import { generationEngine } from './engine/generationEngine'
import { polishPrompt } from './engine/promptPolisher'
import { DEFAULT_SELECTION_SHORTCUT, formatShortcut, shortcutFromKeyboardEvent } from './utils/shortcut'
import sceneFissionAgentPrompt from '../AI模特场景图裂变_Agent提示词.md?raw'
import urbanStyleFissionGridPrompt from '../城市风格裂变9宫格_Agent提示词.md?raw'
import outfitExtractionAgentPrompt from '../AI 穿搭拆解与白底搭配全览生成 Agent｜System Prompt (1).md?raw'
import { ApiSettingsModal } from './components/ApiSettingsModal'
import { ResultViewer } from './components/ResultViewer'
import { Toast } from './components/Toast'
import { OutpaintEditor, OutpaintPayload } from './components/OutpaintEditor'
import { TryOnEditor, TryOnPayload } from './components/TryOnEditor'
import {
  ImageIcon,
  ScissorsIcon,
  VectorIcon,
  SlidersIcon,
  PlusIcon,
  CloseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SparklesIcon,
  SettingsIcon,
  UploadCloudIcon,
  GridIcon,
  UpscaleIcon,
  RemoveBackgroundIcon,
  WardrobeIcon,
  CubeIcon,
  ExpandIcon,
  MoreIcon,
  DownloadIcon,
  TrashIcon,
  BookIcon,
  PaletteIcon,
} from './components/icons'

// Dedicated styling-director rules are kept in the app so the preset remains
// available in the deployed plugin without relying on a local attachment path.
const micasStylingDirectorPrompt = `
# MICAS CLOTHING STYLING DIRECTOR

You are the senior MICAS fashion styling director. Combine the judgment of a
fashion stylist, buyer, visual merchandiser and lookbook art director. Do not
apply a fixed outfit formula: understand the uploaded products first, then
interpret the user's styling line and scene/occasion before building the look.

USER INPUT
- The user may describe the styling line and scene naturally in one sentence.
- Supported directional lines: ELEGANT, CASUAL, SEXY and EDGY. Treat the line
  as a creative direction, not a rigid checklist.
- Parse the scene into occasion, season/weather, time, location, formality,
  activity and mood, then make the outfit practical for that context.

MICAS CUSTOMER AND STYLE DNA
Style for a confident, feminine, modern and fashion-aware Western woman around
35-55. The result should feel polished, elevated high-street, urban, sensual
and wearable. Avoid teenage, childish, matronly, overly conservative,
traditional corporate, pure streetwear and costume styling.

PRODUCT FIDELITY
Analyze every uploaded product and treat each as a HERO PRODUCT. Preserve its
exact color, material, silhouette, length, neckline, sleeves, hardware,
trims and construction. Never redesign, recolor, shorten, lengthen or replace
the hero product. Only complementary items may be invented. When several
products are supplied, create one coherent collection and never omit or
duplicate a hero product.

STYLING JUDGMENT
Explore several plausible directions internally, then choose the strongest
combination for MICAS fit, age fit, scene fit, wearability and originality.
Use controlled variation in shoes, bags, colors, proportions and textures.
Outerwear is optional: add it only when requested, weather/scene requires it,
or it materially improves the look. Accessories should support the garment;
usually choose shoes, a bag and only one or two accessory categories.

IMAGE2 DIRECTOR OUTPUT
Generate the final image directly. Make a premium commercial fashion styling
board / complete outfit image on a pure white background with black minimal
editorial typography. Keep the main MICAS collection title in the top 8-15%
of the canvas and place looks below it with clear separation and generous
white space. Use a dynamic, balanced merchandising layout instead of a fixed
template. Make garments photorealistic with accurate textile texture, leather,
knit and natural soft product shadows. The hero product is always the largest
and most visually accurate element.

NEGATIVE RULES
No product redesign, missing or duplicated hero products, invented changes to
garment details, forced outerwear, excessive accessories, beige/colored
background, colored typography, scrapbook/Pinterest collage, clutter,
watermarks, logos or unreadable decorative text. Perform a final internal
check for product fidelity, MICAS fit, customer age fit, styling-line fit,
scene practicality, variety and title-at-top before generating.
`

interface CommunityPreset {
  id: string
  title: string
  category: '摄影' | '产品' | '3D'
  imgUrl: string
  prompt: string
}

interface StyleAgentPreset {
  id: string
  name: string
  category: string
  description: string
  prompt: string
  mark: string
  inputPlaceholder: string
  executionInstruction: string
  defaultAspectRatio: string
  defaultModelId?: string
  requiresReference: boolean
}

const ASPECT_RATIO_VALUES: Record<string, number> = {
  '1:1': 1,
  '2:3': 2 / 3,
  '3:4': 3 / 4,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
}

function inferReferenceAspectRatio(
  reference: ReferenceImage | undefined,
  supportedRatios: string[] | undefined
): string | null {
  if (!reference?.width || !reference?.height) return null

  const sourceRatio = reference.width / reference.height
  const supported = supportedRatios?.length
    ? supportedRatios
    : Object.keys(ASPECT_RATIO_VALUES)
  const concreteRatios = supported.filter((ratio) => ASPECT_RATIO_VALUES[ratio])
  if (concreteRatios.length === 0) return supported.includes('Original') ? 'Original' : null

  const closest = concreteRatios.reduce((best, ratio) => {
    const distance = Math.abs(Math.log(ASPECT_RATIO_VALUES[ratio] / sourceRatio))
    const bestDistance = Math.abs(Math.log(ASPECT_RATIO_VALUES[best] / sourceRatio))
    return distance < bestDistance ? ratio : best
  }, concreteRatios[0])

  const closestDistance = Math.abs(Math.log(ASPECT_RATIO_VALUES[closest] / sourceRatio))
  if (supported.includes('Original') && closestDistance > 0.06) return 'Original'
  return closest
}

const STYLE_AGENT_PRESETS: StyleAgentPreset[] = [
  {
    id: 'scene-fission-expert',
    name: '场景裂变专家',
    category: '九宫格 · 时尚摄影',
    description: '锁定参考图中的模特、服装、场景与光线，根据你的描述生成同一次拍摄的 3×3 多机位场景裂变图。',
    prompt: sceneFissionAgentPrompt,
    mark: '九',
    inputPlaceholder: '描述九宫格的动作、机位、情绪或构图偏好，例如：动作更松弛、增加低机位、不要背面...',
    executionInstruction: 'Execute the user request now as a single image-generation task. Skip the planning JSON response and directly create one clean, high-definition 3x3 contact sheet with exactly nine distinct fashion photographs. Apply every identity, outfit, scene, lighting, continuity, camera-diversity, anatomy, product-fidelity and no-text rule above. The supplied reference image is the single absolute visual source of truth.',
    defaultAspectRatio: '2:3',
    requiresReference: true,
  },
  {
    id: 'urban-style-fission-grid',
    name: '城市风格裂变9宫格',
    category: '九宫格 · 城市街拍',
    description: '锁定参考图人物与穿搭，在同一城市街区内生成具有连续叙事、真实机位与焦段变化的 3×3 时尚街拍分镜。',
    prompt: urbanStyleFissionGridPrompt,
    mark: '城',
    inputPlaceholder: '描述城市环境、动作或镜头偏好，例如：巴黎街角、更多行走抓拍、增加建筑框景、保持克制表情...',
    executionInstruction: 'Execute the user request now as a single image-generation task. Directly create one clean, high-definition 3x3 editorial contact sheet containing exactly nine distinct citywalk fashion photographs. Preserve the same adult person, face, hair, makeup, body proportions, outfit, accessories, shoes, location, time, weather and lighting across all nine frames. Enforce the required 4 knee-up or three-quarter portraits plus 5 uncropped full-body photographs, with genuine camera-position, focal-length, distance, composition and natural-moment variation. The supplied reference image is the single absolute visual source of truth.',
    defaultAspectRatio: '2:3',
    requiresReference: true,
  },
  {
    id: 'outfit-extraction-expert',
    name: '搭配提取专家',
    category: '白底全览 · 穿搭拆解',
    description: '从人物穿搭参考图中提取所有明确可见单品，生成无模特、无文字、纯白背景的完整电商搭配全览图。',
    prompt: outfitExtractionAgentPrompt,
    mark: '搭',
    inputPlaceholder: '补充本次提取要求，例如：更紧凑的排版、突出服装主体、保留全部可见配饰...',
    executionInstruction: 'Execute the user request now as a single image-generation task. Perform the inventory and fidelity checks internally, then directly generate one premium 2:3 outfit breakdown image on a pure white background. Show only the complete, clearly visible fashion items extracted from the supplied source outfit image. No person, mannequin, hanger, scene, labels, text, logos or invented items.',
    defaultAspectRatio: '2:3',
    defaultModelId: 'gpt-image-2',
    requiresReference: true,
  },
  {
    id: 'micas-clothing-styling-expert',
    name: '\u670d\u88c5\u642d\u914d\u4e13\u5bb6',
    category: '\u642d\u914d\u7b56\u5212 \u00b7 \u98ce\u683c\u573a\u666f',
    description: '\u5206\u6790\u4e0a\u4f20\u7684\u670d\u88c5\u5355\u54c1\uff0c\u6839\u636e\u4f60\u63cf\u8ff0\u7684\u642d\u914d\u7ebf\u8def\u4e0e\u573a\u666f\uff0c\u751f\u6210\u4e13\u4e1a\u7684 MICAS \u5b8c\u6574\u642d\u914d\u56fe\u3002',
    prompt: micasStylingDirectorPrompt,
    mark: '\u642d',
    inputPlaceholder: '\u63cf\u8ff0\u642d\u914d\u7ebf\u8def\u548c\u573a\u666f\uff0c\u4f8b\u5982\uff1aElegant\uff0c\u79cb\u5b63\u665a\u9910\u7ea6\u4f1a\uff0c\u57ce\u5e02\u9910\u5385\u3002',
    executionInstruction: 'Execute the user request now as a single direct image-generation task. First analyze every supplied garment, then infer the requested styling line (Elegant, Casual, Sexy or Edgy) and scene from the user text. Create a complete, commercially wearable MICAS outfit or styling board that preserves every hero garment exactly. Use one look per supplied hero product, a pure white background, black minimal title typography at the top, photorealistic clothing and a balanced editorial merchandising layout. Do not output planning or JSON; generate the final image directly.',
    defaultAspectRatio: '2:3',
    defaultModelId: 'gpt-image-2',
    requiresReference: true,
  },
]

function composeStyleAgentPrompt(preset: StyleAgentPreset, userPrompt: string): string {
  return `${preset.prompt}\n\n=== CURRENT DIRECT IMAGE GENERATION TASK ===\nThe expert preset is active. ${preset.executionInstruction}\n\n用户本次需求：\n${userPrompt.trim()}`
}

const COMMUNITY_PRESETS: CommunityPreset[] = [
  {
    id: 'p1',
    title: '人像特写',
    category: '摄影',
    imgUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    prompt: '高端时尚女性人像特写，眼神凝视镜头，光影对比细腻，8K分辨率',
  },
  {
    id: 'p2',
    title: '竖屏肖像',
    category: '摄影',
    imgUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    prompt: '四宫格复古胶片感竖屏肖像，随性自然连拍，温暖色调',
  },
  {
    id: 'p3',
    title: '室内肖像',
    category: '摄影',
    imgUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&auto=format&fit=crop&q=80',
    prompt: '客厅温馨室内肖像，休闲服装，明亮自然采光，居家沉浸感',
  },
  {
    id: 'p4',
    title: '街拍人像',
    category: '摄影',
    imgUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
    prompt: '城市街头人像街拍，背景带有动态人流动感模糊，商业时尚大片',
  },
  {
    id: 'p5',
    title: '高端商业产品',
    category: '产品',
    imgUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80',
    prompt: '极简高端手表商业摄影，极简底座，柔和演播室环形灯光',
  },
  {
    id: 'p6',
    title: '赛博 3D 角色',
    category: '3D',
    imgUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
    prompt: '赛博朋克 3D 渲染，霓虹发光材质，抽象艺术构图',
  },
]

/**
 * 高性能 Chunk 分块 Base64 转换算法
 */
function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType = 'image/png'): string {
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 8192
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode.apply(null, chunk as any)
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法读取选中图片'))
    image.src = dataUrl
  })
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('裁切图片编码失败'))
        return
      }
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

async function cropImageIntoNineTiles(image: ExportedImagePayload): Promise<InsertImagePayload[]> {
  const source = await loadImageFromDataUrl(uint8ArrayToDataUrl(image.bytes, image.mimeType))
  const sourceWidth = source.naturalWidth
  const sourceHeight = source.naturalHeight
  const baseName = (image.name || 'MasterGo 图片').replace(/\.[^.]+$/, '')
  const tiles: InsertImagePayload[] = []

  for (let row = 0; row < 3; row += 1) {
    const sourceY = Math.floor((row * sourceHeight) / 3)
    const nextY = Math.floor(((row + 1) * sourceHeight) / 3)
    for (let column = 0; column < 3; column += 1) {
      const sourceX = Math.floor((column * sourceWidth) / 3)
      const nextX = Math.floor(((column + 1) * sourceWidth) / 3)
      const width = Math.max(1, nextX - sourceX)
      const height = Math.max(1, nextY - sourceY)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('当前环境不支持图片裁切')
      context.drawImage(source, sourceX, sourceY, width, height, 0, 0, width, height)
      tiles.push({
        bytes: await canvasToPngBytes(canvas),
        mimeType: 'image/png',
        width,
        height,
        name: `${baseName}-九宫格-${row + 1}-${column + 1}`,
      })
    }
  }

  return tiles
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(',')
  const binaryStr = atob(parts[1] || parts[0])
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return bytes
}

function readImageDimensions(url: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const image = new Image()
    const timeout = window.setTimeout(() => resolve({}), 10000)
    image.onload = () => {
      window.clearTimeout(timeout)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      window.clearTimeout(timeout)
      resolve({})
    }
    image.src = url
  })
}

function getImageProxyUrl(relayUrl: string | undefined, imageUrl: string): string | null {
  if (!relayUrl) return null
  try {
    const proxy = new URL(relayUrl)
    proxy.pathname = proxy.pathname.replace(/\/virse\/?$/i, '/image-download')
    proxy.search = `?url=${encodeURIComponent(imageUrl)}`
    return proxy.toString()
  } catch (_) {
    return null
  }
}

async function generatedImageToInsertPayload(
  img: GeneratedImage,
  relayUrl?: string
): Promise<InsertImagePayload> {
  const dimensionsPromise = img.width && img.height
    ? Promise.resolve({ width: img.width, height: img.height })
    : readImageDimensions(img.url)

  let bytes: Uint8Array | undefined
  const sourceUrl = /^https?:/i.test(img.url) ? img.url : undefined
  const proxyUrl = sourceUrl ? getImageProxyUrl(relayUrl, sourceUrl) || undefined : undefined
  if (img.bytes?.length) {
    bytes = img.bytes
  } else if (img.url.startsWith('data:')) {
    bytes = dataUrlToUint8Array(img.url)
  } else {
    let response: Response | null = null
    let directError = ''
    try {
      response = await fetch(img.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error: any) {
      directError = error?.message || String(error)
      if (proxyUrl) {
        try {
          response = await fetch(proxyUrl)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
        } catch (proxyError) {
          console.warn('图片在 UI 中读取失败，改由 MasterGo 主线程下载', directError, proxyError)
          response = null
        }
      }
    }
    if (response) bytes = new Uint8Array(await response.arrayBuffer())
  }

  if (!bytes?.length && !sourceUrl) throw new Error('生成图片内容为空')
  const dimensions = await dimensionsPromise
  return {
    bytes,
    sourceUrl,
    proxyUrl,
    width: dimensions.width,
    height: dimensions.height,
    name: `MICAS AI - ${img.prompt.slice(0, 30)}`,
  }
}

export default function App() {
  const [apiProfile, setApiProfile] = useState<ApiProfile | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<'models' | 'agents' | 'image-host' | 'shortcuts'>('models')
  const [selectionShortcut, setSelectionShortcut] = useState(() => {
    try {
      return localStorage.getItem('micas_selection_shortcut_v1') || DEFAULT_SELECTION_SHORTCUT
    } catch {
      return DEFAULT_SELECTION_SHORTCUT
    }
  })
  const [isCanvasToolbarEnabled, setIsCanvasToolbarEnabled] = useState(() => {
    try {
      return localStorage.getItem('micas_canvas_toolbar_enabled_v1') !== 'false'
    } catch {
      return true
    }
  })
  const canvasToolbarEnabledRef = useRef(isCanvasToolbarEnabled)

  // + 按钮下拉选单状态
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false)

  // 拖拽高亮状态
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false)

  // 社区预设 Modal
  const [isCommunityOpen, setIsCommunityOpen] = useState<boolean>(false)
  const [selectedCommCategory, setSelectedCommCategory] = useState<'全部' | '摄影' | '产品' | '3D'>('全部')

  // 模式选单
  const [genMode, setGenMode] = useState<'generate' | 'edit' | 'icon'>('generate')

  // 参考图 State
  const [references, setReferences] = useState<ReferenceImage[]>([])

  // Prompt 与模型选择
  const [prompt, setPrompt] = useState<string>('')
  const [isPolishing, setIsPolishing] = useState<boolean>(false)
  const [promptLibrary, setPromptLibrary] = useState<PromptLibraryItem[]>([])
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState<boolean>(false)
  const [isStyleLibraryOpen, setIsStyleLibraryOpen] = useState<boolean>(false)
  const [activeStyleAgentId, setActiveStyleAgentId] = useState<string | null>(null)
  const [promptLibraryTitle, setPromptLibraryTitle] = useState<string>('')
  const sortedPromptLibrary = useMemo(() => [...promptLibrary].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  }), [promptLibrary])
  const activeStyleAgent = useMemo(
    () => STYLE_AGENT_PRESETS.find((preset) => preset.id === activeStyleAgentId) || null,
    [activeStyleAgentId]
  )
  const [selectedModel, setSelectedModel] = useState<ExtendedModelDefinition>(getModelById(DEFAULT_MODEL_ID))
  const [isModelMenuOpen, setIsModelMenuOpen] = useState<boolean>(false)
  const availableModels = useMemo(() => getModelsForProfile(apiProfile), [apiProfile])

  useEffect(() => {
    setSelectedModel((current) => (
      availableModels.find((model) => model.id === current.id)
      || availableModels.find((model) => model.id === DEFAULT_MODEL_ID)
      || availableModels[0]
      || getModelById(DEFAULT_MODEL_ID)
    ))
  }, [availableModels])

  useEffect(() => {
    if (!activeStyleAgent || references.length === 0) return
    const inferredRatio = inferReferenceAspectRatio(references[0], selectedModel.supportedRatios)
    if (inferredRatio) setAspectRatio(inferredRatio)
  }, [activeStyleAgent, references, selectedModel])

  // 参数面板浮层控制
  const [isParamPanelOpen, setIsParamPanelOpen] = useState<boolean>(false)
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('2:3')
  const [outputCount, setOutputCount] = useState<number>(1)

  // 生成状态与结果
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [genTimer, setGenTimer] = useState<number>(0)
  const [results, setResults] = useState<GeneratedImage[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const [quickSelection, setQuickSelection] = useState<LayerSummary | null>(null)
  const [outpaintSource, setOutpaintSource] = useState<ReferenceImage | null>(null)
  const [outpaintJobState, setOutpaintJobState] = useState<'idle' | 'running' | 'success'>('idle')
  const [outpaintJobModel, setOutpaintJobModel] = useState('Image 2 · 2K')
  const [isOutpaintMinimized, setIsOutpaintMinimized] = useState(false)
  const [tryOnSource, setTryOnSource] = useState<ReferenceImage | null>(null)
  const [tryOnJobState, setTryOnJobState] = useState<'idle' | 'running' | 'success'>('idle')
  const [tryOnJobModel, setTryOnJobModel] = useState('Nanobanana 2 · 2K')
  const [isTryOnMinimized, setIsTryOnMinimized] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingQuickActionRef = useRef<{ kind: string; prompt?: string } | null>(null)
  // Selection changes are emitted for ordinary canvas clicks and for images that
  // the plugin inserts automatically.  Keep the long-running generation panel
  // mounted for both cases so its request, draft and progress cannot be hidden
  // behind the compact image menu midway through a job.
  const isGeneratingRef = useRef(false)
  const awaitingAutomaticInsertRef = useRef(false)
  const backgroundUiModeRef = useRef(false)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = (event.data?.pluginMessage || event.data) as PluginMessageData | undefined
      if (!msg || !msg.type) return

      switch (msg.type) {
        case PluginMessage.API_PROFILE_LOADED:
          setApiProfile(msg.payload)
          break

        case PluginMessage.SELECTION_IMAGE_EXPORTED:
          void handleMasterGoImagesExported(msg.payload)
          break

        case PluginMessage.SELECTION_CHANGED: {
          const selected = canvasToolbarEnabledRef.current && msg.payload.count === 1 && msg.payload.layers[0]?.isImage
            ? msg.payload.layers[0]
            : null

          if (backgroundUiModeRef.current) {
            setQuickSelection(null)
            setIsOutpaintMinimized(true)
            setIsTryOnMinimized(true)
            sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'generating' } })
            break
          }

          if (isGeneratingRef.current || awaitingAutomaticInsertRef.current) {
            setQuickSelection(null)
            sendMsgToPlugin({
              type: UIMessage.SET_UI_MODE,
              payload: { mode: 'panel' },
            })
            break
          }

          setQuickSelection(selected)
          sendMsgToPlugin({
            type: UIMessage.SET_UI_MODE,
            payload: { mode: selected ? 'image-menu' : 'panel' },
          })
          break
        }

        case PluginMessage.IMAGE_INSERTED:
          // The inserted image becomes the current MasterGo selection. That
          // selection event can arrive just after the insertion acknowledgement,
          // so keep a short guard window and leave the completed result visible.
          window.setTimeout(() => {
            awaitingAutomaticInsertRef.current = false
          }, 750)
          break

        case PluginMessage.GENERATION_HISTORY_LOADED:
          setResults(msg.payload as GeneratedImage[])
          break

        case PluginMessage.PROMPT_LIBRARY_LOADED:
          setPromptLibrary(msg.payload)
          break

        case PluginMessage.TOAST:
          setToast({
            message: msg.payload.message,
            type: msg.payload.messageType || 'info',
          })
          break

        case PluginMessage.ERROR:
          setToast({ message: msg.payload.message, type: 'error' })
          break

        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)
    sendMsgToPlugin({ type: UIMessage.GET_API_PROFILE })
    sendMsgToPlugin({ type: UIMessage.GET_SELECTION })
    sendMsgToPlugin({ type: UIMessage.GET_GENERATION_HISTORY })
    sendMsgToPlugin({ type: UIMessage.GET_PROMPT_LIBRARY })

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  useEffect(() => {
    canvasToolbarEnabledRef.current = isCanvasToolbarEnabled
  }, [isCanvasToolbarEnabled])

  // MasterGo does not expose arbitrary canvas-level shortcut registration;
  // this listener is active whenever the plugin window has keyboard focus.
  useEffect(() => {
    const handleSelectionShortcut = (event: KeyboardEvent) => {
      if (shortcutFromKeyboardEvent(event) !== selectionShortcut) return
      event.preventDefault()
      setQuickSelection(null)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
      sendMsgToPlugin({ type: UIMessage.EXPORT_SELECTION_IMAGE })
      setToast({ message: '正在批量加入画布选中的图片…', type: 'info' })
    }

    window.addEventListener('keydown', handleSelectionShortcut)
    return () => window.removeEventListener('keydown', handleSelectionShortcut)
  }, [selectionShortcut])

  // 剪贴板 Ctrl+V / Cmd+V 粘贴监听
  useEffect(() => {
    const handlePaste = (event: Event) => {
      const e = event as ClipboardEvent
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string
              if (!dataUrl) return
              const imgObj = new Image()
              imgObj.onload = () => {
                const newRef: ReferenceImage = {
                  id: `ref-paste-${Date.now()}-${Math.random()}`,
                  role: references.length === 0 ? 'product' : 'scene',
                  source: 'upload',
                  name: `剪贴板图片-${Date.now()}`,
                  mimeType: file.type || 'image/png',
                  previewUrl: dataUrl,
                  width: imgObj.naturalWidth,
                  height: imgObj.naturalHeight,
                }
                setReferences((prev) => [...prev, newRef])
                setGenMode('edit')
                setToast({ message: '已提取剪贴板图片并添加为参考图！', type: 'success' })
              }
              imgObj.src = dataUrl
            }
            reader.readAsDataURL(file)
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [references])

  // 拖拽上传 (Drag & Drop) 逻辑
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            if (!dataUrl) return
            const imgObj = new Image()
            imgObj.onload = () => {
              const newRef: ReferenceImage = {
                id: `ref-drop-${Date.now()}-${Math.random()}`,
                role: references.length === 0 ? 'product' : 'scene',
                source: 'upload',
                name: file.name,
                mimeType: file.type || 'image/png',
                previewUrl: dataUrl,
                width: imgObj.naturalWidth,
                height: imgObj.naturalHeight,
              }
              setReferences((prev) => [...prev, newRef])
              setGenMode('edit')
              setToast({ message: `拖拽添加参考图成功: ${file.name}`, type: 'success' })
            }
            imgObj.src = dataUrl
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }

  // 拖拽卡片调整参考图顺序
  const [draggedRefIndex, setDraggedRefIndex] = useState<number | null>(null)

  const handleRefDragStart = (e: React.DragEvent, index: number) => {
    setDraggedRefIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleRefDragOverItem = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleRefDropItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedRefIndex === null || draggedRefIndex === targetIndex) return

    setReferences((prev) => {
      const updated = [...prev]
      const [movedItem] = updated.splice(draggedRefIndex, 1)
      updated.splice(targetIndex, 0, movedItem)
      return updated
    })
    setDraggedRefIndex(null)
  }

  // 套用社区 Preset 模板
  const handleSelectPreset = (preset: CommunityPreset) => {
    setPrompt(preset.prompt)
    setIsCommunityOpen(false)
    setToast({ message: `已载入【${preset.title}】灵感提示词！`, type: 'info' })
  }

  // 处理 MasterGo 导出的参考图
  const handleMasterGoImagesExported = async (exportedImages: ExportedImagePayload[]) => {
    const pendingAction = pendingQuickActionRef.current
    pendingQuickActionRef.current = null
    if (!exportedImages || exportedImages.length === 0) return

    if (pendingAction?.kind === 'outpaint') {
      if (exportedImages.length !== 1) {
        setToast({ message: '智能扩图每次仅支持一张图片', type: 'warning' })
        return
      }
      const image = exportedImages[0]
      setQuickSelection(null)
      setOutpaintSource({
        id: `outpaint-source-${image.id}`,
        role: 'composition',
        source: 'mastergo',
        name: image.name,
        mimeType: image.mimeType,
        bytes: image.bytes,
        previewUrl: uint8ArrayToDataUrl(image.bytes, image.mimeType),
        width: image.width,
        height: image.height,
      })
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'outpaint' } })
      return
    }

    if (pendingAction?.kind === 'try-on') {
      if (exportedImages.length !== 1) {
        setToast({ message: '万物上身每次仅支持一张人物底图', type: 'warning' })
        return
      }
      const image = exportedImages[0]
      setQuickSelection(null)
      setTryOnSource({
        id: `tryon-source-${image.id}`,
        role: 'model',
        source: 'mastergo',
        name: image.name,
        mimeType: image.mimeType,
        bytes: image.bytes,
        previewUrl: uint8ArrayToDataUrl(image.bytes, image.mimeType),
        width: image.width,
        height: image.height,
      })
      setTryOnJobState('idle')
      setIsTryOnMinimized(false)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'tryon' } })
      return
    }

    if (pendingAction?.kind === 'grid-crop') {
      if (exportedImages.length !== 1) {
        setToast({ message: '九宫格裁切每次只支持一张图片', type: 'warning' })
        return
      }
      try {
        setToast({ message: '正在将图片等分为 9 张...', type: 'info' })
        const sourceImage = exportedImages[0]
        const tiles = await cropImageIntoNineTiles(sourceImage)
        sendMsgToPlugin({
          type: UIMessage.INSERT_IMAGE_GRID,
          payload: {
            images: tiles,
            sourceNodeId: sourceImage.id,
            columns: 3,
            rows: 3,
            gap: 0,
          },
        })
      } catch (err: any) {
        setToast({ message: `九宫格裁切失败: ${err?.message || err}`, type: 'error' })
      }
      return
    }

    if (pendingAction?.kind === 'download') {
      exportedImages.forEach((img, index) => {
        const blob = new Blob([img.bytes as any], { type: img.mimeType || 'image/png' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${img.name || `MICAS-image-${index + 1}`}.png`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      })
      setToast({ message: '已下载选中图片', type: 'success' })
      return
    }

    if (pendingAction?.prompt) setPrompt(pendingAction.prompt)

    setReferences((prev) => {
      const existingKeySet = new Set(prev.map((r) => r.name || r.id))
      const uniqueNewRefs: ReferenceImage[] = []

      exportedImages.forEach((img, idx) => {
        const uniqueKey = img.id || img.name || `mg-${idx}`
        if (!existingKeySet.has(uniqueKey)) {
          const dataUrl = uint8ArrayToDataUrl(img.bytes, img.mimeType)
          uniqueNewRefs.push({
            id: `ref-mg-${img.id || Date.now()}`,
            role: 'product',
            source: 'mastergo',
            name: img.name,
            mimeType: img.mimeType,
            bytes: img.bytes,
            previewUrl: dataUrl,
            width: img.width,
            height: img.height,
          })
          existingKeySet.add(uniqueKey)
        }
      })

      if (uniqueNewRefs.length === 0) return prev

      setToast({
        message: `已成功提取 ${uniqueNewRefs.length} 个 MasterGo 图层为参考图！`,
        type: 'success',
      })

      return [...prev, ...uniqueNewRefs]
    })

    setGenMode('edit')
  }

  const getModelIcon = (iconType: string) => {
    switch (iconType) {
      case 'openai': return '🌐'
      case 'google': return '🔴'
      case 'seedream': return '🔷'
      case 'virse': return '⚡'
      default: return '⚙'
    }
  }

  // 处理本地图片选择
  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (!dataUrl) return

        const imgObj = new Image()
        imgObj.onload = () => {
          const newRef: ReferenceImage = {
            id: `ref-up-${Date.now()}`,
            role: references.length === 0 ? 'product' : 'scene',
            source: 'upload',
            name: file.name,
            mimeType: file.type || 'image/png',
            previewUrl: dataUrl,
            width: imgObj.naturalWidth,
            height: imgObj.naturalHeight,
          }
          setReferences((prev) => [...prev, newRef])
          setGenMode('edit')
          setToast({ message: '本地参考图已添加！', type: 'success' })
        }
        imgObj.src = dataUrl
      }
      reader.readAsDataURL(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const persistGenerationHistory = (images: GeneratedImage[]) => {
    const history: GenerationHistoryItem[] = images.slice(0, 20).map((image) => ({
      id: image.id,
      url: image.url,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      prompt: image.prompt,
      createdAt: image.createdAt,
    }))
    sendMsgToPlugin({ type: UIMessage.SAVE_GENERATION_HISTORY, payload: history })
  }

  const persistPromptLibrary = (items: PromptLibraryItem[]) => {
    sendMsgToPlugin({ type: UIMessage.SAVE_PROMPT_LIBRARY, payload: items.slice(0, 100) })
  }

  const handleSavePrompt = () => {
    const value = prompt.trim()
    if (!value) {
      setToast({ message: '请先输入要保存的提示词', type: 'warning' })
      return
    }

    const now = Date.now()
    const existing = promptLibrary.find((item) => item.prompt === value)
    const title = promptLibraryTitle.trim() || value.replace(/\s+/g, ' ').slice(0, 22)
    const next = existing
      ? promptLibrary.map((item) => item.id === existing.id
        ? { ...item, title, updatedAt: now }
        : item)
      : [{ id: `prompt-${now}`, title, prompt: value, createdAt: now, updatedAt: now, pinned: false }, ...promptLibrary]

    setPromptLibrary(next.slice(0, 100))
    persistPromptLibrary(next)
    setPromptLibraryTitle('')
    setToast({ message: existing ? '提示词已更新到词库' : '提示词已保存到词库', type: 'success' })
  }

  const handleDeletePrompt = (id: string) => {
    const next = promptLibrary.filter((item) => item.id !== id)
    setPromptLibrary(next)
    persistPromptLibrary(next)
  }

  const handleTogglePromptPin = (id: string) => {
    let nextPinned = false
    const next = promptLibrary.map((item) => {
      if (item.id !== id) return item
      nextPinned = !item.pinned
      return { ...item, pinned: nextPinned, updatedAt: Date.now() }
    })
    setPromptLibrary(next)
    persistPromptLibrary(next)
    setToast({ message: nextPinned ? '提示词已置顶' : '已取消置顶', type: 'success' })
  }

  const handlePolishPrompt = async () => {
    if (!prompt.trim()) {
      setToast({ message: '请先输入需要润色的提示词', type: 'warning' })
      return
    }

    const hasAgentConfig = Boolean(
      apiProfile
      && (apiProfile.agentBaseUrl || apiProfile.provider === 'apilio')
      && (apiProfile.agentApiKey || (apiProfile.provider === 'apilio' && apiProfile.apiKey))
    )
    if (!apiProfile || !hasAgentConfig) {
      setSettingsInitialSection('agents')
      setIsSettingsOpen(true)
      setToast({ message: '请先在“智能体”中配置柏拉图中转', type: 'warning' })
      return
    }

    setIsPolishing(true)
    setToast({ message: 'AI 正在润色提示词...', type: 'info' })
    try {
      const result = await polishPrompt(prompt, apiProfile)
      setPrompt(result.prompt)
      if (result.failures.length > 0) {
        const failed = result.failures.map((item) => `${item.model}: ${item.message}`).join('；')
        console.warn('AI 润色模型自动切换:', result.failures)
        setToast({
          message: `检测到异常并已自动切换：${failed}；最终由 ${result.model} 完成`,
          type: 'warning',
        })
      } else {
        setToast({ message: `AI 润色完成 · ${result.model}`, type: 'success' })
      }
    } catch (error: any) {
      setToast({ message: `AI 润色失败：${error?.message || error}`, type: 'error' })
    } finally {
      setIsPolishing(false)
    }
  }

  const handleSelectStyleAgent = (preset: StyleAgentPreset) => {
    const presetModel = preset.defaultModelId
      ? availableModels.find((model) => model.id === preset.defaultModelId)
      : null
    setActiveStyleAgentId(preset.id)
    setIsStyleLibraryOpen(false)
    setGenMode('edit')
    const targetModel = presetModel || selectedModel
    const inferredRatio = inferReferenceAspectRatio(references[0], targetModel.supportedRatios)
    setAspectRatio(inferredRatio || preset.defaultAspectRatio)
    if (presetModel) setSelectedModel(presetModel)
    setToast({
      message: preset.defaultModelId && !presetModel
        ? `已切换为「${preset.name}」，但当前服务未配置 GPT Image 2，请先在设置中配置`
        : `已切换为「${preset.name}」${presetModel ? ` · ${presetModel.displayName}` : ''}${inferredRatio ? ` · 已识别比例 ${inferredRatio}` : ' · 默认比例 2:3'}`,
      type: preset.defaultModelId && !presetModel ? 'warning' : 'success',
    })
  }

  const insertGeneratedImages = async (images: GeneratedImage[], automatic = false) => {
    try {
      setToast({
        message: automatic ? '生成成功，正在自动插入 MasterGo 画布...' : '正在准备插入 MasterGo 画布...',
        type: 'info',
      })
      const payloads = await Promise.all(images.map((image) => (
        generatedImageToInsertPayload(image, apiProfile?.virseRelayUrl)
      )))
      if (automatic) awaitingAutomaticInsertRef.current = true
      sendMsgToPlugin({
        type: UIMessage.INSERT_IMAGES,
        payload: { images: payloads },
      })
    } catch (err: any) {
      if (automatic) awaitingAutomaticInsertRef.current = false
      console.error('插图失败:', err)
      setToast({
        message: `图片已生成，但自动插入失败: ${err?.message || err}`,
        type: 'error',
      })
    }
  }

  // 发起 AI 生成
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setToast({ message: '请描述你想生成的图片内容', type: 'warning' })
      return
    }

    if (!apiProfile || !apiProfile.apiKey) {
      setSettingsInitialSection('models')
      setIsSettingsOpen(true)
      setToast({ message: '请配置您的 API Key (BYOK)', type: 'warning' })
      return
    }

    if (activeStyleAgent?.requiresReference && references.length === 0) {
      setToast({ message: `${activeStyleAgent.name}需要至少上传一张参考图`, type: 'warning' })
      return
    }

    isGeneratingRef.current = true
    awaitingAutomaticInsertRef.current = false
    setQuickSelection(null)
    sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
    setIsGenerating(true)
    setGenTimer(0)
    const timerInterval = setInterval(() => {
      setGenTimer((t) => t + 1)
    }, 1000)

    setToast({ message: 'MICAS AI 正在为您生成商业视觉大图...', type: 'info' })

    const request: GenerationRequest = {
      intent: references.length > 0 ? 'edit' : 'generate',
      prompt: activeStyleAgent ? composeStyleAgentPrompt(activeStyleAgent, prompt) : prompt,
      model: selectedModel,
      references,
      aspectRatio,
      resolution,
      outputCount,
    }

    try {
      const job = await generationEngine.generate(request, apiProfile)
      if (job.status === 'completed' && job.results) {
        const completedResults = activeStyleAgent
          ? job.results.map((image) => ({ ...image, prompt: `[${activeStyleAgent.name}] ${prompt.trim()}` }))
          : job.results
        setResults((prev) => {
          const nextResults = [...completedResults, ...prev].slice(0, 20)
          persistGenerationHistory(nextResults)
          return nextResults
        })
        setIsHistoryOpen(true)
        await insertGeneratedImages(completedResults, true)
      } else {
        setToast({ message: job.error?.message || '生成失败，请检查 API 设置', type: 'error' })
      }
    } catch (err: any) {
      setToast({ message: `生成请求异常: ${err?.message || err}`, type: 'error' })
    } finally {
      clearInterval(timerInterval)
      isGeneratingRef.current = false
      setIsGenerating(false)
    }
  }

  const handleOutpaintGenerate = async ({
    reference,
    aspectRatio: targetRatio,
    prompt: outpaintPrompt,
    modelId: outpaintModelId,
    resolution: outpaintResolution,
  }: OutpaintPayload) => {
    if (!apiProfile || !apiProfile.apiKey) {
      setOutpaintSource(null)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
      setSettingsInitialSection('models')
      setIsSettingsOpen(true)
      setToast({ message: '请先配置 API Key 后再使用智能扩图', type: 'warning' })
      return
    }

    isGeneratingRef.current = true
    awaitingAutomaticInsertRef.current = false
    backgroundUiModeRef.current = true
    setIsGenerating(true)
    setOutpaintJobState('running')
    setOutpaintJobModel(`${outpaintModelId === 'gpt-image-2' ? 'Image 2' : 'Nanobanana 2'} · ${outpaintResolution}`)
    setIsOutpaintMinimized(true)
    sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'generating' } })
    setGenTimer(0)
    const timerInterval = setInterval(() => setGenTimer((value) => value + 1), 1000)
    setToast({ message: '正在锁定原图并生成透明扩展区域…', type: 'info' })

    const outpaintModel = availableModels.find((model) => model.id === outpaintModelId)
      || getModelById(outpaintModelId)
    const request: GenerationRequest = {
      intent: 'edit',
      prompt: outpaintPrompt,
      model: outpaintModel,
      references: [reference],
      aspectRatio: targetRatio,
      resolution: outpaintResolution,
      outputCount,
      parameters: { operation: 'outpaint', preserveSourcePixels: true },
    }

    try {
      const job = await generationEngine.generate(request, apiProfile)
      if (job.status !== 'completed' || !job.results?.length) {
        backgroundUiModeRef.current = false
        setOutpaintJobState('idle')
        setIsOutpaintMinimized(false)
        sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'outpaint' } })
        setToast({ message: job.error?.message || '智能扩图生成失败', type: 'error' })
        return
      }

      const completedResults = job.results.map((image) => ({
        ...image,
        prompt: `[智能扩图 ${targetRatio}] ${outpaintPrompt}`,
      }))
      setResults((previous) => {
        const nextResults = [...completedResults, ...previous].slice(0, 20)
        persistGenerationHistory(nextResults)
        return nextResults
      })
      setIsHistoryOpen(true)
      await insertGeneratedImages(completedResults, true)
      setOutpaintSource(null)
      setOutpaintJobState('success')
      setIsOutpaintMinimized(true)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'generating' } })
      setToast({ message: '智能扩图已生成并自动插入画布', type: 'success' })
    } catch (error: any) {
      backgroundUiModeRef.current = false
      setOutpaintJobState('idle')
      setIsOutpaintMinimized(false)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'outpaint' } })
      setToast({ message: `智能扩图异常：${error?.message || error}`, type: 'error' })
    } finally {
      clearInterval(timerInterval)
      isGeneratingRef.current = false
      setIsGenerating(false)
    }
  }

  const handleTryOnGenerate = async ({
    references: tryOnReferences,
    prompt: tryOnPrompt,
    aspectRatio: tryOnRatio,
    modelId: tryOnModelId,
    resolution: tryOnResolution,
  }: TryOnPayload) => {
    if (!apiProfile || !apiProfile.apiKey) {
      setTryOnSource(null)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
      setSettingsInitialSection('models')
      setIsSettingsOpen(true)
      setToast({ message: '请先配置 API Key 后再使用万物上身', type: 'warning' })
      return
    }

    isGeneratingRef.current = true
    awaitingAutomaticInsertRef.current = false
    backgroundUiModeRef.current = true
    setIsGenerating(true)
    setTryOnJobState('running')
    setTryOnJobModel(`${tryOnModelId === 'gpt-image-2' ? 'Image 2' : 'Nanobanana 2'} · ${tryOnResolution}`)
    setIsTryOnMinimized(true)
    sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'generating' } })
    setGenTimer(0)
    const timerInterval = setInterval(() => setGenTimer((value) => value + 1), 1000)
    setToast({ message: '万物上身已转入后台生成，可继续操作画布', type: 'info' })

    const tryOnModel = availableModels.find((model) => model.id === tryOnModelId)
      || getModelById(tryOnModelId)
    const request: GenerationRequest = {
      intent: 'edit',
      prompt: tryOnPrompt,
      model: tryOnModel,
      references: tryOnReferences,
      aspectRatio: tryOnRatio,
      resolution: tryOnResolution,
      outputCount: 1,
      parameters: { operation: 'virtual-try-on', preserveIdentity: true, preservePose: true },
    }

    try {
      const job = await generationEngine.generate(request, apiProfile)
      if (job.status !== 'completed' || !job.results?.length) {
        backgroundUiModeRef.current = false
        setTryOnJobState('idle')
        setIsTryOnMinimized(false)
        sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'tryon' } })
        setToast({ message: job.error?.message || '万物上身生成失败', type: 'error' })
        return
      }

      const completedResults = job.results.map((image) => ({
        ...image,
        prompt: `[万物上身] ${tryOnPrompt}`,
      }))
      setResults((previous) => {
        const nextResults = [...completedResults, ...previous].slice(0, 20)
        persistGenerationHistory(nextResults)
        return nextResults
      })
      setIsHistoryOpen(true)
      await insertGeneratedImages(completedResults, true)
      setTryOnSource(null)
      setTryOnJobState('success')
      setIsTryOnMinimized(true)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'generating' } })
      setToast({ message: '换装图片已生成并自动插入画布', type: 'success' })
    } catch (error: any) {
      backgroundUiModeRef.current = false
      setTryOnJobState('idle')
      setIsTryOnMinimized(false)
      sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'tryon' } })
      setToast({ message: `万物上身异常：${error?.message || error}`, type: 'error' })
    } finally {
      clearInterval(timerInterval)
      isGeneratingRef.current = false
      setIsGenerating(false)
    }
  }

  // 插回画布
  const handleInsertToCanvas = async (img: GeneratedImage) => {
    await insertGeneratedImages([img])
  }

  const openFullPanel = () => {
    setQuickSelection(null)
    sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
  }

  const runQuickImageAction = (kind: string, promptValue?: string) => {
    pendingQuickActionRef.current = { kind, prompt: promptValue }
    if (kind === 'upscale') setResolution('2K')
    if (kind === 'grid-crop') {
      setToast({ message: '正在读取图片并准备九宫格裁切...', type: 'info' })
    }
    sendMsgToPlugin({
      type: UIMessage.EXPORT_SELECTION_IMAGE,
      payload: kind === 'grid-crop' ? { maxDimension: 4096 } : undefined,
    })
    if (kind !== 'download') openFullPanel()
  }

  const clearGenerationHistory = () => {
    setResults([])
    persistGenerationHistory([])
    setToast({ message: '生成记录已清空', type: 'info' })
  }

  const deleteGenerationHistoryItem = (image: GeneratedImage) => {
    setResults((currentResults) => {
      const nextResults = currentResults.filter((item) => item.id !== image.id)
      persistGenerationHistory(nextResults)
      return nextResults
    })
    setToast({ message: '已删除该条生成记录', type: 'info' })
  }

  const filteredPresets = selectedCommCategory === '全部'
    ? COMMUNITY_PRESETS
    : COMMUNITY_PRESETS.filter((p) => p.category === selectedCommCategory)

  if (outpaintJobState !== 'idle' && isOutpaintMinimized) {
    const completed = outpaintJobState === 'success'
    return (
      <div className={`generation-mini ${completed ? 'success' : ''}`}>
        <span className="generation-mini-icon">{completed ? '✓' : <span className="generation-mini-spinner" />}</span>
        <span className="generation-mini-copy">
          <strong>{completed ? '扩图已完成' : '智能扩图生成中'}</strong>
          <small>{completed ? '已自动插入画布' : `${outpaintJobModel} · ${genTimer}s`}</small>
        </span>
        <button
          onClick={() => {
            if (completed) {
              backgroundUiModeRef.current = false
              setOutpaintJobState('idle')
              setIsOutpaintMinimized(false)
              sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
              return
            }
            setIsOutpaintMinimized(false)
            sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'outpaint' } })
          }}
        >
          {completed ? '打开面板' : '展开'}
        </button>
      </div>
    )
  }

  if (tryOnJobState !== 'idle' && isTryOnMinimized) {
    const completed = tryOnJobState === 'success'
    return (
      <div className={`generation-mini ${completed ? 'success' : ''}`}>
        <span className="generation-mini-icon">{completed ? '✓' : <span className="generation-mini-spinner" />}</span>
        <span className="generation-mini-copy">
          <strong>{completed ? '换装已完成' : '万物上身生成中'}</strong>
          <small>{completed ? '已自动插入画布' : `${tryOnJobModel} · ${genTimer}s`}</small>
        </span>
        <button
          onClick={() => {
            if (completed) {
              backgroundUiModeRef.current = false
              setTryOnJobState('idle')
              setIsTryOnMinimized(false)
              sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
              return
            }
            setIsTryOnMinimized(false)
            sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'tryon' } })
          }}
        >
          {completed ? '打开面板' : '展开'}
        </button>
      </div>
    )
  }

  if (outpaintSource) {
    return (
      <>
        <OutpaintEditor
          source={outpaintSource}
          isGenerating={isGenerating}
          onCancel={() => {
            backgroundUiModeRef.current = false
            setOutpaintJobState('idle')
            setIsOutpaintMinimized(false)
            setOutpaintSource(null)
            sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
          }}
          onMinimize={() => {
            setIsOutpaintMinimized(true)
            sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'generating' } })
          }}
          onGenerate={handleOutpaintGenerate}
        />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    )
  }

  if (tryOnSource) {
    return (
      <>
        <TryOnEditor
          source={tryOnSource}
          isGenerating={isGenerating}
          onCancel={() => {
            backgroundUiModeRef.current = false
            setTryOnJobState('idle')
            setIsTryOnMinimized(false)
            setTryOnSource(null)
            sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
          }}
          onMinimize={() => {
            setIsTryOnMinimized(true)
            sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'generating' } })
          }}
          onGenerate={handleTryOnGenerate}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    )
  }

  const quickImageMenu = quickSelection ? (
      <div className="image-context-menu" role="toolbar" aria-label={`图片快捷操作：${quickSelection.name}`}>
        <div className="image-context-list">
          <button className="image-context-brand" onClick={() => runQuickImageAction('add')} title="将当前图片加入 MICAS 参考图"><span><PlusIcon size={15} /></span>加入插件</button>
          <button onClick={() => runQuickImageAction('edit', '保持人物、服装和构图一致，请根据我的描述对选中图片进行精细编辑')}><span><SparklesIcon size={15} /></span>快捷编辑</button>
          <button onClick={() => runQuickImageAction('grid-crop')}><span><GridIcon size={15} /></span>九宫格</button>
          <button onClick={() => runQuickImageAction('upscale', '高清放大当前图片，增强材质与细节，保持原始构图和内容不变')}><span><UpscaleIcon size={15} /></span>放大</button>
          <button onClick={() => runQuickImageAction('outpaint')}><span><ExpandIcon size={15} /></span>智能扩图</button>
          <button onClick={() => runQuickImageAction('remove-bg', '移除背景，精准保留人物或商品边缘，输出干净的透明背景 PNG')}><span><RemoveBackgroundIcon size={15} /></span>去背景</button>
          <button onClick={() => runQuickImageAction('try-on')}><span><WardrobeIcon size={15} /></span>万物上身</button>
          <button onClick={() => runQuickImageAction('angles', '基于当前人物或商品生成不同拍摄角度，保持主体、服装与场景一致')}><span><CubeIcon size={15} /></span>多角度</button>
          <button onClick={() => runQuickImageAction('adjust', '优化选中图片的色彩、光影、对比度与商业质感，保持内容不变')}><span><SlidersIcon size={15} /></span>画面调整</button>
          <button className="image-context-panel" onClick={openFullPanel} title="打开 MICAS 主面板"><span><MoreIcon size={16} /></span>主面板</button>
          <button className="image-context-download" onClick={() => runQuickImageAction('download')} title="下载图片" aria-label="下载图片"><span><DownloadIcon size={17} /></span></button>
        </div>
      </div>
  ) : (
    <div className="image-context-menu image-context-menu-empty">
      <div className="image-context-header">
        <span className="image-context-logo">XC</span>
        <span className="image-context-title">快捷编辑</span>
      </div>
      <div className="image-context-empty-state">
        <span className="image-context-empty-icon">◇</span>
        <strong>请选择一张图片</strong>
        <p>选中 MasterGo 画布图片后，快捷操作会显示在这里。</p>
      </div>
    </div>
  )

  return (
    <div className={`micas-dual-shell ${quickSelection ? 'show-image-menu' : ''}`}>
      {quickImageMenu}
      <div className="micas-container-v2">
      {/* 隐藏的本地文件输入框 */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleLocalUpload}
      />

      {/* 1. 顶栏 Header */}
      <header className="v2-header">
        <div className="v2-header-title">
          <div className="v2-app-icon"><SparklesIcon size={13} color="#FFFFFF" /></div>
          <span>MICAS-Visual AI</span>
        </div>
        <div className="v2-header-actions">
          <button
            className={`v2-header-settings-btn v2-header-history-btn ${isHistoryOpen ? 'active' : ''}`}
            title="查看生成记录"
            onClick={() => {
              setIsPromptLibraryOpen(false)
              setIsStyleLibraryOpen(false)
              setIsHistoryOpen((open) => !open)
            }}
          >
            <span className="v2-history-clock">↺</span>
            <span>生成记录{results.length > 0 ? ` (${results.length})` : ''}</span>
          </button>
          <button
            className={`v2-header-settings-btn v2-toolbar-toggle ${isCanvasToolbarEnabled ? 'active' : ''}`}
            title={isCanvasToolbarEnabled ? '关闭画布图片快捷栏' : '开启画布图片快捷栏'}
            aria-pressed={isCanvasToolbarEnabled}
            onClick={() => {
              const next = !isCanvasToolbarEnabled
              setIsCanvasToolbarEnabled(next)
              canvasToolbarEnabledRef.current = next
              try {
                localStorage.setItem('micas_canvas_toolbar_enabled_v1', String(next))
              } catch {
                // Keep the preference for this session if storage is unavailable.
              }
              if (!next) {
                setQuickSelection(null)
                sendMsgToPlugin({ type: UIMessage.SET_UI_MODE, payload: { mode: 'panel' } })
              } else {
                sendMsgToPlugin({ type: UIMessage.GET_SELECTION })
              }
            }}
          >
            <span className="v2-toolbar-switch"><i /></span>
            <span>快捷栏</span>
          </button>
          <button
            className="v2-header-settings-btn"
            title="配置 API 参数 (BYOK Key)"
            onClick={() => {
              setSettingsInitialSection('models')
              setIsSettingsOpen(true)
            }}
          >
            <SettingsIcon size={13} color="#D1D5DB" />
            <span>设置</span>
          </button>
        </div>
      </header>

      {/* 2. Gallery 从预设快速创建卡片 */}
      <div className="v2-gallery-card" onClick={() => setIsCommunityOpen(true)}>
        <div className="v2-gallery-left">
          <span className="v2-gallery-script">Micas视觉社区</span>
          <span className="v2-gallery-sub">从预设快速创建</span>
        </div>
        <img
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60"
          alt="Community Preset Gallery"
          className="v2-gallery-avatar"
        />
      </div>

      {/* 3. 虚线参考图框 (支持拖拽文件 / 复制粘贴 / 原生卡片拖拽直接换序) */}
      <div
        className={`v2-ref-dashed-card v2-reference-section ${isDraggingOver ? 'dragging-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="v2-ref-left"
          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
        >
          <span className="v2-ref-icon"><ImageIcon size={16} color="#E4E4E7" /></span>
          <span>
            {references.length > 0
              ? '上传参考图'
              : '上传/拖拽/粘贴参考图 (Ctrl+V)'}
          </span>
        </div>

        <div className="v2-ref-right-group">
          {/* 内嵌参考图缩略图 (直接鼠标拖拽卡片对调顺序，黑白极简角标) */}
          {references.map((ref, idx) => (
            <div
              key={ref.id}
              className={`v2-ref-inline-thumb-wrapper ${draggedRefIndex === idx ? 'dragging-item' : ''}`}
              draggable
              onDragStart={(e) => handleRefDragStart(e, idx)}
              onDragOver={handleRefDragOverItem}
              onDrop={(e) => handleRefDropItem(e, idx)}
              title="按住鼠标拖拽即可直接换序"
            >
              <span className="v2-ref-number-badge">图 {idx + 1}</span>

              <img src={ref.previewUrl} alt={`图 ${idx + 1}`} className="v2-ref-inline-img" />

              {/* 删除按钮 */}
              <button
                className="v2-ref-inline-del"
                title="删除参考图"
                onClick={(e) => {
                  e.stopPropagation()
                  setReferences((prev) => prev.filter((r) => r.id !== ref.id))
                }}
              >
                <CloseIcon size={10} color="#FFFFFF" />
              </button>
            </div>
          ))}

          {/* + 按钮 */}
          <button
            className="v2-ref-add-btn"
            title="添加参考图"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          >
            <PlusIcon size={14} color="#FFFFFF" />
          </button>

          {references.length > 0 && (
            <button
              className="v2-ref-clear-btn"
              title="删除全部参考图"
              aria-label="删除全部参考图"
              onClick={() => {
                setReferences([])
                setIsAddMenuOpen(false)
                setToast({ message: '已删除全部参考图', type: 'info' })
              }}
            >
              <TrashIcon size={14} />
              <span>清空</span>
            </button>
          )}

          {/* + 按钮弹出菜单 */}
          {isAddMenuOpen && (
            <div className="v2-add-menu-floating">
              <div
                className="v2-add-menu-item"
                onClick={() => {
                  sendMsgToPlugin({ type: UIMessage.EXPORT_SELECTION_IMAGE })
                  setIsAddMenuOpen(false)
                }}
              >
                <span><ImageIcon size={14} /></span>
                <span className="v2-add-menu-copy">
                  <strong>来自选中</strong>
                  <small>快捷键 {formatShortcut(selectionShortcut)}</small>
                </span>
              </div>
              <div
                className="v2-add-menu-item"
                onClick={() => {
                  fileInputRef.current?.click()
                  setIsAddMenuOpen(false)
                }}
              >
                <span><UploadCloudIcon size={14} /></span>
                <span className="v2-add-menu-copy"><strong>浏览文件</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. 核心 Prompt 描述框 */}
      <div className={`v2-prompt-box ${activeStyleAgent ? 'has-active-agent' : ''}`}>
        {activeStyleAgent && (
          <div className="v2-active-agent-bar">
            <div>
              <span className="v2-active-agent-dot" />
              <strong>{activeStyleAgent.name}</strong>
              <span>已启用</span>
            </div>
            <button
              title="退出专家模式"
              onClick={() => {
                setActiveStyleAgentId(null)
                setToast({ message: '已退出专家模式', type: 'info' })
              }}
            >
              ×
            </button>
          </div>
        )}
        <textarea
          className="v2-prompt-textarea"
          placeholder={activeStyleAgent
            ? activeStyleAgent.inputPlaceholder
            : '通过文本或参考图描述图片内容...'}
          title="拖动输入框右下角可上下调整高度"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="v2-prompt-bottom-bar">
          <div className="v2-segmented-control">
            <button
              className={`v2-segment-btn ${genMode === 'generate' ? 'active' : ''}`}
              onClick={() => setGenMode('generate')}
            >
              生图
            </button>
            <button
              className={`v2-segment-btn ${genMode === 'edit' ? 'active' : ''}`}
              onClick={() => setGenMode('edit')}
            >
              改图
            </button>
            <button
              className={`v2-segment-btn ${genMode === 'icon' ? 'active' : ''}`}
              onClick={() => setGenMode('icon')}
            >
              图标
            </button>
          </div>

          <div className="v2-model-selector-wrapper">
            <button
              className="v2-model-select-btn"
              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
            >
              <span>{getModelIcon(selectedModel.iconType)}</span>
              <span>{selectedModel.displayName}</span>
              <span>▲</span>
            </button>

            {isModelMenuOpen && (
              <div className="v2-model-menu-floating">
                {availableModels.map((m) => (
                  <div
                    key={m.id}
                    className={`v2-model-menu-item ${
                      selectedModel.id === m.id ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedModel(m)
                      setIsModelMenuOpen(false)
                    }}
                  >
                    <span className="model-brand-icon">{getModelIcon(m.iconType)}</span>
                    <span>{m.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. 快捷工具栏 */}
      <div className="v2-quick-toolbar">
        <button
          className="v2-quick-btn v2-ai-polish-btn"
          disabled={isPolishing}
          onClick={handlePolishPrompt}
        >
          <SparklesIcon size={14} />
          <span>{isPolishing ? '润色中...' : 'AI 润色'}</span>
        </button>
        <button
          className={`v2-quick-btn ${isPromptLibraryOpen ? 'active' : ''}`}
          onClick={() => {
            setIsHistoryOpen(false)
            setIsStyleLibraryOpen(false)
            setIsPromptLibraryOpen((open) => !open)
          }}
        >
          <BookIcon size={14} />
          <span>词库{promptLibrary.length > 0 ? ` (${promptLibrary.length})` : ''}</span>
        </button>
        <button
          className={`v2-quick-btn v2-style-library-btn ${isStyleLibraryOpen || activeStyleAgent ? 'active' : ''}`}
          onClick={() => {
            setIsHistoryOpen(false)
            setIsPromptLibraryOpen(false)
            setIsStyleLibraryOpen((open) => !open)
          }}
        >
          <PaletteIcon size={14} />
          <span>{activeStyleAgent ? activeStyleAgent.name : '风格库'}</span>
        </button>
        <button
          className="v2-quick-btn"
          onClick={() => {
            setPrompt('移除背景，智能精准抠图，透明背景 PNG')
            setGenMode('edit')
          }}
        >
          <ScissorsIcon size={14} />
          <span>快速抠图</span>
        </button>
        <button
          className="v2-quick-btn"
          onClick={() => {
            setPrompt('扁平矢量图标风格，极简线条，高分辨率 Vector Graphic')
            setGenMode('icon')
          }}
        >
          <VectorIcon size={14} />
          <span>图转矢量</span>
        </button>
      </div>

      {isPromptLibraryOpen && (
        <div className="v2-prompt-library-panel">
          <div className="v2-prompt-library-head">
            <div>
              <strong>我的提示词库</strong>
              <span>{promptLibrary.length}/100</span>
            </div>
            <button onClick={() => setIsPromptLibraryOpen(false)} title="关闭词库">×</button>
          </div>
          <div className="v2-prompt-library-save">
            <input
              value={promptLibraryTitle}
              placeholder="名称（可选）"
              onChange={(event) => setPromptLibraryTitle(event.target.value)}
            />
            <button onClick={handleSavePrompt}>保存当前 Prompt</button>
          </div>
          <div className="v2-prompt-library-list">
            {promptLibrary.length === 0 ? (
              <div className="v2-prompt-library-empty">还没有保存的提示词</div>
            ) : sortedPromptLibrary.map((item) => (
              <div className={`v2-prompt-library-item ${item.pinned ? 'pinned' : ''}`} key={item.id}>
                <div>
                  <strong>{item.pinned && <span className="v2-pinned-mark">置顶</span>}{item.title}</strong>
                  <p>{item.prompt}</p>
                </div>
                <div className="v2-prompt-library-actions">
                  <button className="pin" onClick={() => handleTogglePromptPin(item.id)}>
                    {item.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button onClick={() => {
                    setPrompt(item.prompt)
                    setIsPromptLibraryOpen(false)
                    setToast({ message: '已从词库载入提示词', type: 'success' })
                  }}>使用</button>
                  <button className="danger" onClick={() => handleDeletePrompt(item.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isStyleLibraryOpen && (
        <div className="v2-prompt-library-panel v2-style-library-panel">
          <div className="v2-prompt-library-head">
            <div>
              <strong>风格库预设</strong>
              <span>{STYLE_AGENT_PRESETS.length} 位内置专家</span>
            </div>
            <button onClick={() => setIsStyleLibraryOpen(false)} title="关闭风格库">×</button>
          </div>
          <p className="v2-style-library-intro">选择专家后，完整 Agent 规则会在生成时自动应用，你只需在输入框描述本次需求。</p>
          <div className="v2-style-agent-list">
            {STYLE_AGENT_PRESETS.map((preset) => {
              const isActive = preset.id === activeStyleAgentId
              return (
                <button
                  key={preset.id}
                  className={`v2-style-agent-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectStyleAgent(preset)}
                >
                  <span className="v2-style-agent-mark">{preset.mark}</span>
                  <span className="v2-style-agent-copy">
                    <span className="v2-style-agent-heading">
                      <strong>{preset.name}</strong>
                      <small>{isActive ? '使用中' : preset.category}</small>
                    </span>
                    <span>{preset.description}</span>
                  </span>
                  <span className="v2-style-agent-action">{isActive ? '✓' : '启用'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* MICAS AI 沉浸式 Loading 卡片 (高级等待动画) */}
      {isGenerating && (
        <div className="v2-ai-loading-card">
          <div className="v2-loading-header">
            <div className="v2-loading-badge">
              <span className="v2-pulse-dot" />
              <span>MICAS AI 商业级大图渲染中</span>
            </div>
            <span className="v2-loading-timer">{genTimer}s</span>
          </div>

          <div className="v2-skeleton-preview-box">
            <div className="v2-skeleton-shimmer" />
            <div className="v2-loading-center-spinner">
              <div className="v2-spinner-ring" />
            </div>
          </div>

          <div className="v2-ticker-text">
            {genTimer < 5 && '正在解析提示词与参考图材质特征...'}
            {genTimer >= 5 && genTimer < 12 && '初始化高精度扩散模型节点...'}
            {genTimer >= 12 && genTimer < 25 && 'MICAS AI 神经网络多阶绘制与漫反射渲染中...'}
            {genTimer >= 25 && '正在优化商业光影、色调与超分辨率细节...'}
          </div>
        </div>
      )}

      {/* 可持久的生成记录 */}
      {isHistoryOpen && (
        <div className="v2-results-container v2-history-panel">
          <div className="v2-history-panel-head">
            <div>
              <strong>生成记录</strong>
              <span>{results.length} 张</span>
            </div>
            {results.length > 0 && <button onClick={clearGenerationHistory}>清空</button>}
          </div>
          {results.length === 0 ? (
            <div className="v2-history-empty">暂无生成记录</div>
          ) : (
            <ResultViewer
              results={results}
              onInsertToCanvas={handleInsertToCanvas}
              onDelete={deleteGenerationHistoryItem}
              onReuseAsReference={(img) => {
                setReferences((prev) => [
                  ...prev,
                  {
                    id: `ref-reuse-${Date.now()}`,
                    role: 'style',
                    source: 'upload',
                    previewUrl: img.url,
                    mimeType: 'image/png',
                  },
                ])
                setToast({ message: '已设为新的参考图！', type: 'success' })
              }}
            />
          )}
        </div>
      )}

      {/* 6. 悬浮参数面板 */}
      {isParamPanelOpen && (
        <div className="v2-popover-panel">
          <div className="v2-popover-header">
            <span className="v2-popover-title">清晰度与参数设置</span>
            <button
              className="v2-popover-close"
              onClick={() => setIsParamPanelOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="v2-popover-row">
            <div className="v2-resolution-capsule">
              <button
                className={`v2-capsule-btn ${resolution === '1K' ? 'active' : ''}`}
                onClick={() => setResolution('1K')}
              >
                1K
              </button>
              <button
                className={`v2-capsule-btn ${resolution === '2K' ? 'active' : ''}`}
                onClick={() => setResolution('2K')}
              >
                2K
              </button>
              <button
                className={`v2-capsule-btn ${resolution === '4K' ? 'active' : ''}`}
                onClick={() => setResolution('4K')}
              >
                4K
              </button>
            </div>
            <span className="v2-time-estimate">
              {resolution === '4K' ? '预计 90 ~ 180s' : '预计 40 ~ 60s'}
            </span>
          </div>

          <div className="v2-ratio-selector-container">
            <span className="v2-ratio-label">画面比例</span>
            <div className="v2-ratio-capsule-grid">
              {[
                { id: 'Original', label: '原图自适应', icon: '📐' },
                { id: '1:1', label: '1:1 方形', icon: '⏹' },
                { id: '2:3', label: '2:3 竖图', icon: '📱' },
                { id: '3:4', label: '3:4 电商', icon: '📱' },
                { id: '4:5', label: '4:5 社交', icon: '📱' },
                { id: '16:9', label: '16:9 横屏', icon: '💻' },
                { id: '9:16', label: '9:16 海报', icon: '📲' },
              ].map((r) => (
                <button
                  key={r.id}
                  className={`v2-ratio-capsule-item ${aspectRatio === r.id ? 'active' : ''}`}
                  onClick={() => setAspectRatio(r.id)}
                >
                  <span className="ratio-icon">{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. 社区 Modal */}
      {isCommunityOpen && (
        <div className="modal-overlay" onClick={() => setIsCommunityOpen(false)}>
          <div className="v2-community-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="v2-community-header">
              <div>
                <span className="v2-community-title">探索精选预设</span>
                <span className="v2-community-sublink">获取更多 prompt ↗</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsCommunityOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="v2-community-tabs">
              {(['全部', '摄影', '产品', '3D'] as const).map((cat) => (
                <button
                  key={cat}
                  className={`v2-comm-tab-btn ${selectedCommCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCommCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="v2-community-grid">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="v2-comm-card"
                  onClick={() => handleSelectPreset(preset)}
                >
                  <img src={preset.imgUrl} alt={preset.title} className="v2-comm-img" />
                  <div className="v2-comm-label">{preset.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. 底部固定生成工具栏 */}
      <div className="v2-bottom-bar">
        <button
          className="v2-param-toggle-btn"
          title="打开/关闭参数配置"
          onClick={() => setIsParamPanelOpen(!isParamPanelOpen)}
        >
          <SlidersIcon size={18} />
        </button>

        <button
          className={`v2-generate-submit-btn ${isGenerating ? 'generating' : ''}`}
          disabled={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? (
            <>
              <div className="v2-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span>生成中 ({genTimer}s)...</span>
            </>
          ) : (
            '生成图片'
          )}
        </button>
      </div>

      {/* API 设置 Modal */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        initialProfile={apiProfile}
        initialSection={settingsInitialSection}
        selectionShortcut={selectionShortcut}
        onSelectionShortcutChange={(shortcut) => {
          setSelectionShortcut(shortcut)
          try {
            localStorage.setItem('micas_selection_shortcut_v1', shortcut)
          } catch {
            // The in-memory preference remains active if storage is unavailable.
          }
        }}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(prof) => {
          setApiProfile(prof)
          sendMsgToPlugin({ type: UIMessage.SAVE_API_PROFILE, payload: prof })
          setIsSettingsOpen(false)
        }}
      />

      {/* 全局 Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      </div>
    </div>
  )
}
