// MasterGo 插件与 UI 之间的双向 Bridge 消息定义

export interface LayerSummary {
  id: string
  name: string
  type: string
  width?: number
  height?: number
  imageDataUrl?: string
  isImage?: boolean
}

export interface SelectionPayload {
  count: number
  layers: LayerSummary[]
}

export interface ApiProfile {
  id: string
  name: string
  provider: 'apilio' | 'openai-compatible' | 'gemini' | 'virse' | 'custom'
  baseUrl: string
  apiKey: string
  defaultModelId?: string
  protocol?: 'openai-image' | 'openai-chat' | 'gemini' | 'virse' | 'custom'
  /** 当前图床；缺省时保持向后兼容并使用 ImgBB。 */
  imageHostProvider?: 'imgbb' | 'uploadcare' | 'freeimage'
  imgbbApiKey?: string
  uploadcarePublicKey?: string
  freeimageApiKey?: string
  workspaceId?: string
  /** HTTPS endpoint of the Virse MCP relay, for example https://example.com/api/virse. */
  virseRelayUrl?: string
  /** Canonical UI model id -> provider-specific model id. */
  modelIdMap?: Record<string, string>
  /** 独立的柏拉图智能体中转地址；图片服务使用 Virse 时仍可用于提示词润色。 */
  agentBaseUrl?: string
  /** 独立的柏拉图智能体 API Key。 */
  agentApiKey?: string
}

export interface ExportedImagePayload {
  id: string
  name: string
  bytes: Uint8Array
  mimeType: string
  width: number
  height: number
}

export interface InsertImagePayload {
  bytes?: Uint8Array
  mimeType?: string
  sourceUrl?: string
  proxyUrl?: string
  width?: number
  height?: number
  name?: string
}

export interface InsertImagesPayload {
  images: InsertImagePayload[]
}

export interface InsertImageGridPayload {
  images: InsertImagePayload[]
  sourceNodeId: string
  columns: number
  rows: number
  gap?: number
}

export interface ExportSelectionImagePayload {
  maxDimension?: number
}

export interface SetUiModePayload {
  mode: 'panel' | 'image-menu' | 'outpaint' | 'tryon' | 'generating'
  anchor?: { x: number; y: number }
}

export interface GenerationHistoryItem {
  id: string
  url: string
  mimeType: string
  width?: number
  height?: number
  prompt: string
  createdAt: number
}

export interface PromptLibraryItem {
  id: string
  title: string
  prompt: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

export enum PluginMessage {
  CONNECTED = 'CONNECTED',
  PONG = 'PONG',
  SELECTION_CHANGED = 'SELECTION_CHANGED',
  SELECTION_IMAGE_EXPORTED = 'SELECTION_IMAGE_EXPORTED',
  API_PROFILE_LOADED = 'API_PROFILE_LOADED',
  API_PROFILE_SAVED = 'API_PROFILE_SAVED',
  IMAGE_INSERTED = 'IMAGE_INSERTED',
  GENERATION_HISTORY_LOADED = 'GENERATION_HISTORY_LOADED',
  PROMPT_LIBRARY_LOADED = 'PROMPT_LIBRARY_LOADED',
  ERROR = 'ERROR',
  TOAST = 'TOAST',
}

export enum UIMessage {
  PING = 'PING',
  GET_SELECTION = 'GET_SELECTION',
  EXPORT_SELECTION_IMAGE = 'EXPORT_SELECTION_IMAGE',
  GET_API_PROFILE = 'GET_API_PROFILE',
  SAVE_API_PROFILE = 'SAVE_API_PROFILE',
  INSERT_IMAGE = 'INSERT_IMAGE',
  INSERT_IMAGES = 'INSERT_IMAGES',
  INSERT_IMAGE_GRID = 'INSERT_IMAGE_GRID',
  SET_UI_MODE = 'SET_UI_MODE',
  GET_GENERATION_HISTORY = 'GET_GENERATION_HISTORY',
  SAVE_GENERATION_HISTORY = 'SAVE_GENERATION_HISTORY',
  GET_PROMPT_LIBRARY = 'GET_PROMPT_LIBRARY',
  SAVE_PROMPT_LIBRARY = 'SAVE_PROMPT_LIBRARY',
}

export type PluginMessageData =
  | { type: PluginMessage.CONNECTED }
  | { type: PluginMessage.PONG }
  | { type: PluginMessage.SELECTION_CHANGED; payload: SelectionPayload }
  | { type: PluginMessage.SELECTION_IMAGE_EXPORTED; payload: ExportedImagePayload[] }
  | { type: PluginMessage.API_PROFILE_LOADED; payload: ApiProfile | null }
  | { type: PluginMessage.API_PROFILE_SAVED; payload: { success: boolean } }
  | { type: PluginMessage.IMAGE_INSERTED; payload: { success: boolean } }
  | { type: PluginMessage.GENERATION_HISTORY_LOADED; payload: GenerationHistoryItem[] }
  | { type: PluginMessage.PROMPT_LIBRARY_LOADED; payload: PromptLibraryItem[] }
  | { type: PluginMessage.ERROR; payload: { message: string } }
  | { type: PluginMessage.TOAST; payload: { message: string; messageType?: 'success' | 'error' | 'warning' | 'info' } }

export type UIMessageData =
  | { type: UIMessage.PING }
  | { type: UIMessage.GET_SELECTION }
  | { type: UIMessage.EXPORT_SELECTION_IMAGE; payload?: ExportSelectionImagePayload }
  | { type: UIMessage.GET_API_PROFILE }
  | { type: UIMessage.SAVE_API_PROFILE; payload: ApiProfile }
  | { type: UIMessage.INSERT_IMAGE; payload: InsertImagePayload }
  | { type: UIMessage.INSERT_IMAGES; payload: InsertImagesPayload }
  | { type: UIMessage.INSERT_IMAGE_GRID; payload: InsertImageGridPayload }
  | { type: UIMessage.SET_UI_MODE; payload: SetUiModePayload }
  | { type: UIMessage.GET_GENERATION_HISTORY }
  | { type: UIMessage.SAVE_GENERATION_HISTORY; payload: GenerationHistoryItem[] }
  | { type: UIMessage.GET_PROMPT_LIBRARY }
  | { type: UIMessage.SAVE_PROMPT_LIBRARY; payload: PromptLibraryItem[] }

/**
 * 向 UI 发送消息 (从 Main 调用)
 */
export const sendMsgToUI = (data: PluginMessageData) => {
  try {
    mg.ui.postMessage(data, '*')
  } catch (e) {
    console.error('发送消息到 UI 失败:', e)
  }
}

/**
 * 向插件 Main 发送消息 (从 UI 调用)
 * 仅单次标准发包，杜绝重复触发
 */
export const sendMsgToPlugin = (data: UIMessageData) => {
  try {
    parent.postMessage({ pluginMessage: data }, '*')
  } catch (e) {
    console.error('发送消息到插件主进程失败:', e)
  }
}
