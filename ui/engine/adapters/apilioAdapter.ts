import {
  ImageProviderAdapter,
  ConnectionResult,
  GenerationRequest,
  GenerationJob,
  GeneratedImage,
} from '../types'
import { ApiProfile } from '@messages/sender'
import { composePromptWithRoles } from '../promptComposer'
import { getImageHostApiKey, uploadToConfiguredImageHost } from '../../utils/imgbb'

const DEFAULT_PLATO_BASE_URL = 'https://api.bltcy.ai'
const PLATO_MODEL_IDS = [
  'seedream-v5-pro',
  'gpt-image-2',
  'gemini-3.1-flash-image-preview',
  'nano-banana-pro',
]

const readError = async (response: Response): Promise<string> => {
  const raw = await response.text()
  try {
    const payload = JSON.parse(raw)
    return String(payload?.error?.message || payload?.error || payload?.message || raw)
  } catch (_) {
    return raw || response.statusText || `HTTP ${response.status}`
  }
}

const parseProviderModels = (payload: any): Array<{ id: string; name?: string; provider?: string }> => {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : []
  return items
    .map((model: any) => ({
      id: String(model?.id || model?.model_id || model?.name || ''),
      name: model?.name || model?.display_name || model?.id,
      provider: model?.owned_by || model?.provider,
    }))
    .filter((model: { id: string }) => Boolean(model.id))
}

export class ApilioAdapter implements ImageProviderAdapter {
  async testConnection(profile: ApiProfile): Promise<ConnectionResult> {
    if (!profile.apiKey?.trim()) return { success: false, message: '请先填写柏拉图 API Key' }
    const baseUrl = (profile.baseUrl || DEFAULT_PLATO_BASE_URL).trim().replace(/\/+$/, '')

    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${profile.apiKey.trim()}` },
      })
      if (!response.ok) {
        const message = await readError(response)
        if (response.status === 401 || response.status === 403) {
          return { success: false, message: `柏拉图 API Key 无效或没有访问权限 (${response.status})：${message}` }
        }
        return { success: false, message: `柏拉图节点响应异常 [HTTP ${response.status}]：${message}` }
      }

      const models = parseProviderModels(await response.json())
      const availableIds = new Set(models.map((model) => model.id))
      const matched = PLATO_MODEL_IDS.filter((modelId) => availableIds.has(modelId))
      const missing = PLATO_MODEL_IDS.filter((modelId) => !availableIds.has(modelId))
      const detail = models.length === 0
        ? '节点已连接，但 /v1/models 未返回可解析的模型列表'
        : `目标模型连通 ${matched.length}/${PLATO_MODEL_IDS.length}${missing.length ? `，未发现：${missing.join('、')}` : ''}`
      return {
        success: true,
        message: `柏拉图 API 连接成功；${detail}`,
        models,
      }
    } catch (error: any) {
      const message = String(error?.message || error)
      const hint = /failed to fetch|networkerror|cors/i.test(message)
        ? '。请确认 Base URL 为 HTTPS，并允许 MasterGo Origin: null 跨域访问'
        : ''
      return { success: false, message: `无法连接柏拉图 API：${message}${hint}` }
    }
  }

  async submit(request: GenerationRequest, profile: ApiProfile): Promise<GenerationJob> {
    if (!profile.apiKey?.trim()) {
      return { status: 'failed', error: { message: '缺少柏拉图 API Key，请先在设置中配置' } }
    }

    const baseUrl = (profile.baseUrl || DEFAULT_PLATO_BASE_URL).trim().replace(/\/+$/, '')
    const fullPrompt = composePromptWithRoles(request.prompt, request.references)
    const modelId = request.model.modelId || 'gemini-3.1-flash-image-preview'

    try {
      const referenceUrls: string[] = []
      const imageHostApiKey = getImageHostApiKey(profile)
      for (const reference of request.references) {
        if (!reference.previewUrl) continue
        let imageUrl = reference.previewUrl
        if (imageHostApiKey && imageUrl.startsWith('data:')) {
          imageUrl = await uploadToConfiguredImageHost(
            imageUrl,
            profile,
            reference.name
          )
        }
        referenceUrls.push(imageUrl)
      }

      const hasReferences = referenceUrls.length > 0
      const endpoint = `${baseUrl}${hasReferences ? '/v1/images/edits' : '/v1/images/generations'}`
      const requestedResolution = request.resolution || '2K'
      const outputSize = this.mapSizeToResolution(request.aspectRatio, request)
      const payload: Record<string, unknown> = {
        model: modelId,
        prompt: fullPrompt,
        n: request.outputCount || 1,
        size: outputSize,
        image_size: outputSize,
        imageSize: requestedResolution,
        resolution: requestedResolution,
        quality: requestedResolution === '1K' ? 'standard' : 'hd',
        response_format: 'url',
      }
      if (hasReferences) {
        payload.image = referenceUrls[0]
        if (referenceUrls.length > 1) payload.extra_images = referenceUrls.slice(1)
        if (request.parameters?.operation === 'outpaint') {
          // The padded PNG carries alpha only in the expansion area. Providers
          // compatible with the image-edits contract can use it as the edit mask.
          payload.mask = referenceUrls[0]
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${profile.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        return {
          status: 'failed',
          error: {
            code: String(response.status),
            message: `柏拉图生成失败 [HTTP ${response.status}]：${await readError(response)}`,
          },
        }
      }

      const data = await response.json()
      const outputItems = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.images)
          ? data.images
          : []
      const now = Date.now()
      const results: GeneratedImage[] = outputItems.flatMap((item: any, index: number) => {
        const image = item?.url || item?.b64_json || item?.image_url
        if (!image) return []
        const url = /^data:|^https?:/i.test(image) ? image : `data:image/png;base64,${image}`
        return [{
          id: `gen-plato-${now}-${index}`,
          url,
          mimeType: 'image/png',
          prompt: request.prompt,
          createdAt: now,
        }]
      })
      if (results.length === 0) {
        return { status: 'failed', error: { message: '柏拉图接口未返回有效的生成图片数据' } }
      }
      return { status: 'completed', progress: 100, results }
    } catch (error: any) {
      return { status: 'failed', error: { message: `柏拉图网络请求失败：${error?.message || error}` } }
    }
  }

  private mapSizeToResolution(aspectRatio?: string, request?: GenerationRequest): string {
    const resolution = request?.resolution || '2K'
    const maxEdge = resolution === '4K' ? 4096 : resolution === '2K' ? 2048 : 1024
    if (aspectRatio === 'Original' || (!aspectRatio && request?.references?.length)) {
      const reference = request?.references?.[0]
      if (reference?.width && reference?.height) {
        const scale = maxEdge / Math.max(reference.width, reference.height)
        return `${Math.max(1, Math.round(reference.width * scale))}x${Math.max(1, Math.round(reference.height * scale))}`
      }
    }
    const ratioDimensions: Record<string, [number, number]> = {
      '1:1': [1, 1],
      '2:3': [2, 3],
      '3:4': [3, 4],
      '4:5': [4, 5],
      '4:3': [4, 3],
      '3:2': [3, 2],
      '5:4': [5, 4],
      '16:9': [16, 9],
      '9:16': [9, 16],
    }
    const parsedRatio = aspectRatio?.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
    const fallbackRatio: [number, number] = parsedRatio
      ? [Number(parsedRatio[1]), Number(parsedRatio[2])]
      : [2, 3]
    const [ratioWidth, ratioHeight] = ratioDimensions[aspectRatio || ''] || fallbackRatio
    if (ratioWidth >= ratioHeight) {
      return `${maxEdge}x${Math.round(maxEdge * ratioHeight / ratioWidth)}`
    }
    return `${Math.round(maxEdge * ratioWidth / ratioHeight)}x${maxEdge}`
  }
}
