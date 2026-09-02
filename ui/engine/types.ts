import { ApiProfile } from '@messages/sender'

export type ReferenceRole =
  | 'product'
  | 'model'
  | 'scene'
  | 'pose'
  | 'style'
  | 'hair'
  | 'makeup'
  | 'composition'
  | 'color'
  | 'other'

export interface ReferenceImage {
  id: string
  role: ReferenceRole
  source: 'upload' | 'mastergo'
  /** Original MasterGo node used to keep generated output beside its source product. */
  anchorNodeId?: string
  name?: string
  mimeType: string
  bytes?: Uint8Array
  previewUrl: string
  strength?: number
  locked?: boolean
  instruction?: string
  width?: number
  height?: number
}

export type GenerationIntent = 'generate' | 'edit' | 'compose'

export interface ModelDefinition {
  id: string
  displayName: string
  provider: string
  modelId: string
  protocol: 'openai-image' | 'openai-chat' | 'gemini' | 'virse' | 'custom'
  capabilities: {
    textToImage: boolean
    imageToImage: boolean
    multiImage: boolean
  }
  maxReferences?: number
  supportedRatios?: string[]
  supportedResolutions?: string[]
}

export interface GenerationRequest {
  intent: GenerationIntent
  prompt: string
  model: ModelDefinition
  references: ReferenceImage[]
  aspectRatio?: string
  resolution?: string
  outputCount?: number
  seed?: number
  parameters?: Record<string, unknown>
}

export interface GeneratedImage {
  id: string
  url: string
  bytes?: Uint8Array
  mimeType: string
  width?: number
  height?: number
  prompt: string
  createdAt: number
  /** In-memory derived result; never persist this Blob URL to clientStorage. */
  transient?: boolean
}

export interface GenerationJob {
  id?: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  results?: GeneratedImage[]
  error?: {
    code?: string
    message: string
  }
}

export interface ConnectionResult {
  success: boolean
  message: string
  baseUrl?: string
  workspaces?: Array<{ id: string; name: string }>
  models?: Array<{ id: string; name?: string; provider?: string }>
}

export interface ImageProviderAdapter {
  testConnection(profile: ApiProfile, signal?: AbortSignal): Promise<ConnectionResult>

  submit(
    request: GenerationRequest,
    profile: ApiProfile,
    signal?: AbortSignal
  ): Promise<GenerationJob>

  poll?(
    job: GenerationJob,
    profile: ApiProfile
  ): Promise<GenerationJob>

  cancel?(
    job: GenerationJob,
    profile: ApiProfile
  ): Promise<void>
}
