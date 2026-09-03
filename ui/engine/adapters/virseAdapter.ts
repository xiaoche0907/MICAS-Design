import {
  ImageProviderAdapter,
  ConnectionResult,
  GenerationRequest,
  GenerationJob,
  GeneratedImage,
} from '../types'
import { ApiProfile } from '@messages/sender'
import { composePromptWithRoles } from '../promptComposer'
import {
  getImageHostApiKey,
  getImageHostCredentialLabel,
  getImageHostDisplayName,
  getImageHostProvider,
  uploadToImageHost,
} from '../../utils/imgbb'
import { matchProviderModels, ProviderModel } from '../modelRegistry'

const VIRSE_PROTOCOL_VERSION = '2025-03-26'
const DEFAULT_VIRSE_BASE_URL = 'https://api.virse.ai'
const ALLOWED_VIRSE_BASE_URLS = new Set([
  'https://api.virse.ai',
  'https://dev.virse.ai',
])

interface VirseToolResult {
  data: unknown
  content?: any[]
}

interface VirseWorkspace {
  spaceId: string
  canvasId: string
  name: string
}

const normalizeBaseUrl = (value?: string): string => {
  const normalized = String(value || DEFAULT_VIRSE_BASE_URL)
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/mcp$/i, '')
  if (!ALLOWED_VIRSE_BASE_URLS.has(normalized)) {
    throw new Error('Virse Base URL 仅支持 https://api.virse.ai 或 https://dev.virse.ai')
  }
  return normalized
}

const normalizeRelayUrl = (value?: string): string => String(value || '').trim().replace(/\/+$/, '')

const parseMcpResponse = (raw: string, contentType = ''): any => {
  if (!raw) return {}
  if (contentType.includes('text/event-stream')) {
    let lastMessage: any = {}
    raw.split(/\r?\n/).forEach((line) => {
      if (!line.startsWith('data:')) return
      try {
        lastMessage = JSON.parse(line.slice(5).trim())
      } catch (_) {
        // Ignore MCP keep-alives and non-JSON SSE events.
      }
    })
    return lastMessage
  }
  return JSON.parse(raw)
}

const parseTextPayload = (texts: string[]): unknown => {
  if (texts.length !== 1) return texts
  try {
    return JSON.parse(texts[0])
  } catch (_) {
    return texts[0]
  }
}

const errorMessageFromResponse = async (response: Response): Promise<string> => {
  const raw = await response.text()
  try {
    const payload = JSON.parse(raw)
    return String(payload?.error?.message || payload?.error || payload?.message || raw)
  } catch (_) {
    return raw || `HTTP ${response.status}`
  }
}

const findStringField = (value: unknown, fields: string[], depth = 0): string => {
  if (depth > 8 || value == null) return ''
  if (typeof value === 'string') {
    for (const field of fields) {
      const match = value.match(new RegExp(`${field}\\s*[:=]\\s*[^a-z0-9_-]*([a-z0-9_.-]+)`, 'i'))
      if (match?.[1]) return match[1]
    }
    try {
      return findStringField(JSON.parse(value), fields, depth + 1)
    } catch (_) {
      return ''
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringField(item, fields, depth + 1)
      if (found) return found
    }
    return ''
  }
  if (typeof value !== 'object') return ''
  const objectValue = value as Record<string, unknown>
  for (const field of fields) {
    if (typeof objectValue[field] === 'string') return objectValue[field] as string
  }
  for (const nested of Object.values(objectValue)) {
    const found = findStringField(nested, fields, depth + 1)
    if (found) return found
  }
  return ''
}

const findStatus = (value: unknown, depth = 0): string => {
  if (depth > 8 || value == null) return ''
  if (typeof value === 'string') {
    const lineStatus = value.replace(/\\n/g, '\n').match(/(?:^|\n)\s*(?:status|state)\s*[:=]\s*["'`]*([a-z_-]+)/i)?.[1]
    if (lineStatus) return lineStatus.toLowerCase()
    try {
      return findStatus(JSON.parse(value), depth + 1)
    } catch (_) {
      return ''
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const status = findStatus(item, depth + 1)
      if (status) return status
    }
    return ''
  }
  if (typeof value !== 'object') return ''
  const objectValue = value as Record<string, unknown>
  for (const field of ['status', 'state']) {
    if (typeof objectValue[field] === 'string') return String(objectValue[field]).toLowerCase()
  }
  for (const [key, nested] of Object.entries(objectValue)) {
    if (/prompt|instruction/i.test(key)) continue
    const status = findStatus(nested, depth + 1)
    if (status) return status
  }
  return ''
}

const collectImageUrls = (
  value: unknown,
  urls = new Set<string>(),
  path: string[] = [],
  depth = 0
): string[] => {
  if (depth > 9 || value == null) return [...urls]
  if (/prompt|instruction|input|source|reference|original/i.test(path.join('.'))) return [...urls]
  if (typeof value === 'string') {
    try {
      collectImageUrls(JSON.parse(value), urls, path, depth + 1)
    } catch (_) {
      for (const match of value.matchAll(/https?:\/\/[^\s"'`<>]+/g)) {
        const url = match[0].replace(/[),.;]+$/, '')
        if (/\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(url) || /image|artifact|asset|output|cdn|storage/i.test(url)) {
          urls.add(url)
        }
      }
    }
    return [...urls]
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageUrls(item, urls, [...path, String(index)], depth + 1))
  } else if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      collectImageUrls(nested, urls, [...path, key], depth + 1)
    })
  }
  return [...urls]
}

const deepCollections = (value: unknown, depth = 0): any[][] => {
  if (depth > 7 || value == null) return []
  if (typeof value === 'string') {
    try {
      return deepCollections(JSON.parse(value), depth + 1)
    } catch (_) {
      return []
    }
  }
  if (Array.isArray(value)) {
    const own = value.length > 0 && value.every((item) => item && typeof item === 'object') ? [value] : []
    return [...own, ...value.flatMap((item) => deepCollections(item, depth + 1))]
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) => deepCollections(item, depth + 1))
  }
  return []
}

const parseWorkspaceText = (value: unknown): VirseWorkspace[] => {
  if (typeof value !== 'string') return []
  const normalized = value.replace(/\\n/g, '\n')
  const bracketRows = normalized.split(/\r?\n/).map((line, index): VirseWorkspace | null => {
    const bracket = line.match(/^\s*[-*]?\s*\[([^\]]+)\]/)
    const canvas = line.match(/canvas_id\s*[:=]\s*["'`]*([^\s,|"'`]+)/i)
    if (!bracket || !canvas) return null
    const afterBracket = line.slice((bracket.index || 0) + bracket[0].length)
    const canvasOffset = afterBracket.search(/canvas_id\s*[:=]/i)
    const rawName = (canvasOffset >= 0 ? afterBracket.slice(0, canvasOffset) : afterBracket)
      .replace(/\s+(?:—|–|-|\|)\s+.*$/u, '')
      .replace(/^\s*(?:name\s*[:=])?\s*/i, '')
      .replace(/[\s,|:;-]+$/, '')
      .trim()
    return {
      spaceId: bracket[1].trim(),
      canvasId: canvas[1].trim(),
      name: rawName || `Virse 工作区 ${index + 1}`,
    }
  }).filter((workspace): workspace is VirseWorkspace => Boolean(workspace))
  if (bracketRows.length > 0) return bracketRows

  const spaces = [...normalized.matchAll(/space_id\s*[:=]\s*["'`]*([^\s,|"'`]+)/gi)]
  return spaces.map((match, index) => {
    const start = match.index || 0
    const end = spaces[index + 1]?.index ?? normalized.length
    const block = normalized.slice(Math.max(0, start - 180), end)
    const canvasId = block.match(/canvas_id\s*[:=]\s*["'`]*([^\s,|"'`]+)/i)?.[1] || ''
    const name = block.match(/(?:name|workspace_name|space_name)\s*[:=]\s*["'`]*([^\n,|"'`]+)/i)?.[1]
    return { spaceId: match[1], canvasId, name: name?.trim() || `Virse 工作区 ${index + 1}` }
  }).filter((item) => item.spaceId && item.canvasId)
}

const parseWorkspaces = (value: unknown): VirseWorkspace[] => {
  for (const collection of deepCollections(value)) {
    const workspaces = collection.map((item: any, index): VirseWorkspace => ({
      spaceId: String(item.space_id || item.spaceId || item.id || ''),
      canvasId: String(item.canvas_id || item.canvasId || item.canvas?.id || item.project_id || ''),
      name: String(item.name || item.space_name || item.title || `Virse 工作区 ${index + 1}`),
    })).filter((item) => item.spaceId && item.canvasId)
    if (workspaces.length > 0) return workspaces
  }
  return parseWorkspaceText(value)
}

const parseVirseModels = (value: unknown): ProviderModel[] => {
  for (const collection of deepCollections(value)) {
    const models = collection.map((item: any): ProviderModel => ({
      id: String(item.model_id || item.modelId || item.slug || item.id || ''),
      name: item.name || item.display_name || item.title || item.model_id || item.id,
      provider: item.provider || item.owned_by,
    })).filter((model, index) => {
      const source: any = collection[index]
      return Boolean(model.id) && !source?.space_id && !source?.canvas_id
    })
    if (models.length > 0) return models
  }
  if (typeof value !== 'string') return []
  const models = new Map<string, ProviderModel>()
  for (const line of value.replace(/\\n/g, '\n').split(/\r?\n/)) {
    const bracketId = line.match(/^\s*\[([^\]]+)\]/)?.[1]
    const explicitId = line.match(/(?:model_id|model id|id)\s*[:=]\s*[`'"*]*([^\s,|`'"*]+)/i)?.[1]
    const id = explicitId || bracketId || ''
    if (!id || !/[a-z]/i.test(id)) continue
    const name = line.match(/(?:display_name|name)\s*[:=]\s*[`'"*]*([^,|`'"*]+)/i)?.[1]
    models.set(id, { id, name: name?.trim() || id })
  }
  return [...models.values()]
}

const encodeWorkspace = (workspace: VirseWorkspace): string => JSON.stringify({
  spaceId: workspace.spaceId,
  canvasId: workspace.canvasId,
})

const decodeWorkspace = (value?: string): { spaceId: string; canvasId: string } => {
  if (!value) return { spaceId: '', canvasId: '' }
  try {
    const parsed = JSON.parse(value)
    return {
      spaceId: String(parsed.spaceId || parsed.space_id || ''),
      canvasId: String(parsed.canvasId || parsed.canvas_id || ''),
    }
  } catch (_) {
    return { spaceId: value, canvasId: value }
  }
}

export class VirseAdapter implements ImageProviderAdapter {
  private async callDirectMcp(profile: ApiProfile, tool: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<VirseToolResult> {
    const baseUrl = normalizeBaseUrl(profile.baseUrl)
    const postMcp = async (body: Record<string, unknown>, sessionId = ''): Promise<{ data: any; sessionId: string }> => {
      const headers: Record<string, string> = {
        Accept: 'application/json, text/event-stream;q=0.9',
        Authorization: `Bearer ${profile.apiKey.trim()}`,
        'Content-Type': 'application/json',
      }
      if (sessionId) headers['mcp-session-id'] = sessionId
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })
      if (!response.ok) throw new Error(await errorMessageFromResponse(response))
      const raw = await response.text()
      return {
        data: parseMcpResponse(raw, response.headers.get('content-type') || ''),
        sessionId: response.headers.get('mcp-session-id') || sessionId,
      }
    }

    const initialized = await postMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: VIRSE_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'micas-design-mastergo', version: '1.0.0' },
      },
    })
    if (initialized.data?.error) throw new Error(initialized.data.error.message || 'Virse MCP 初始化失败')

    await postMcp({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    }, initialized.sessionId)

    const called = await postMcp({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }, initialized.sessionId)
    return this.unwrapMcpToolResult(called.data, tool)
  }

  private unwrapMcpToolResult(payload: any, tool: string): VirseToolResult {
    if (payload?.error) throw new Error(payload.error.message || `Virse ${tool} 调用失败`)
    const result = payload?.result ?? payload
    if (result?.isError) {
      const message = result.content?.find((item: any) => item?.type === 'text')?.text
      throw new Error(message || `Virse ${tool} 返回错误`)
    }
    const content = Array.isArray(result?.content) ? result.content : []
    const texts = content
      .filter((item: any) => item?.type === 'text' && typeof item.text === 'string')
      .map((item: any) => item.text)
    const structured = result?.structuredContent ?? result?.structured_content ?? result?.data
    return {
      data: structured !== undefined ? structured : parseTextPayload(texts),
      content,
    }
  }

  private async callTool(profile: ApiProfile, tool: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<VirseToolResult> {
    if (!profile.apiKey?.trim()) throw new Error('缺少 Virse API Key')
    const relayUrl = normalizeRelayUrl(profile.virseRelayUrl)
    if (!relayUrl) return this.callDirectMcp(profile, tool, args, signal)

    let relayError = ''
    try {
      const response = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: profile.apiKey.trim(),
          baseUrl: normalizeBaseUrl(profile.baseUrl),
          tool,
          args,
        }),
        signal,
      })
      if (!response.ok) throw new Error(await errorMessageFromResponse(response))
      return await response.json()
    } catch (error: any) {
      if (signal?.aborted || error?.name === 'AbortError') throw error
      relayError = String(error?.message || error)
    }

    try {
      return await this.callDirectMcp(profile, tool, args, signal)
    } catch (directError: any) {
      throw new Error(`中转请求失败：${relayError}；Virse 直连也失败：${directError?.message || directError}`)
    }
  }

  async testConnection(profile: ApiProfile, signal?: AbortSignal): Promise<ConnectionResult> {
    if (!profile.apiKey?.trim()) return { success: false, message: '请先填写 Virse API Key' }
    const preferredBaseUrl = normalizeBaseUrl(profile.baseUrl)
    const candidates = [
      preferredBaseUrl,
      preferredBaseUrl === 'https://api.virse.ai' ? 'https://dev.virse.ai' : 'https://api.virse.ai',
    ]
    let lastError: any = null
    let lastModels: ProviderModel[] = []

    for (const candidate of candidates) {
      const candidateProfile = { ...profile, baseUrl: candidate }
      try {
        await this.callTool(candidateProfile, 'get_account', {}, signal)
        const [workspaceResult, modelResult] = await Promise.all([
          this.callTool(candidateProfile, 'list_workspaces', {}, signal),
          this.callTool(candidateProfile, 'list_image_models', {}, signal),
        ])
        const workspaces = parseWorkspaces(workspaceResult.data)
        const models = parseVirseModels(modelResult.data)
        lastModels = models
        if (workspaces.length === 0) continue

        const matchedModels = matchProviderModels(models)
        return {
          success: true,
          baseUrl: candidate,
          message: `Virse MCP 连接成功；${candidate.includes('dev.') ? 'Dev 节点' : 'API 节点'}；工作区/画布 ${workspaces.length} 个；可用模型 ${models.length} 个`,
          workspaces: workspaces.map((workspace) => ({
            id: encodeWorkspace(workspace),
            name: workspace.name,
          })),
          models,
        }
      } catch (error) {
        lastError = error
      }
    }

    const message = String(lastError?.message || lastError || '两个 Virse 节点均未返回可用工作区/画布')
    const corsHint = /failed to fetch|cors|networkerror/i.test(message)
      ? '；请确认中转为 HTTPS 且响应 Access-Control-Allow-Origin: *'
      : ''
    return {
      success: false,
      message: `Virse 账户已验证，但 API 与 Dev 节点均未解析到工作区/画布：${message}${corsHint}`,
      models: lastModels,
      workspaces: [],
    }
  }

  async submit(request: GenerationRequest, profile: ApiProfile, signal?: AbortSignal): Promise<GenerationJob> {
    if (!profile.apiKey?.trim()) {
      return { status: 'failed', error: { message: '缺少 Virse API Key，请先在设置中配置' } }
    }

    try {
      const { spaceId, canvasId } = decodeWorkspace(profile.workspaceId)
      if (!spaceId || !canvasId) throw new Error('请先测试连接并选择 Virse 工作区/画布')

      const assetIds: string[] = []
      const imageHostProvider = getImageHostProvider(profile)
      const imageHostApiKey = getImageHostApiKey(profile)
      for (let index = 0; index < request.references.length; index += 1) {
        const reference = request.references[index]
        let imageUrl = reference.previewUrl
        if (!/^https:\/\//i.test(imageUrl)) {
          if (!imageHostApiKey) {
            throw new Error(
              `使用 Virse 参考图时必须填写 ${getImageHostDisplayName(imageHostProvider)} ${getImageHostCredentialLabel(imageHostProvider)}`
            )
          }
          imageUrl = await uploadToImageHost(
            imageUrl,
            imageHostProvider,
            imageHostApiKey,
            reference.name,
            signal
          )
        }
        const uploaded = await this.callTool(profile, 'upload_image', {
          image_url: imageUrl,
          space_id: spaceId,
          canvas_id: canvasId,
          filename: reference.name || `reference-${index + 1}.png`,
          position_x: index * 540,
          position_y: 0,
          size_width: reference.width || 512,
          size_height: reference.height || 512,
        }, signal)
        const assetId = findStringField(uploaded.data, ['asset_id', 'assetId', 'image_asset_id', 'id'])
        if (!assetId) throw new Error(`Virse 已接收第 ${index + 1} 张参考图，但未返回 asset_id`)
        assetIds.push(assetId)
      }

      const ratio = request.aspectRatio === 'Original'
        ? this.ratioFromReference(request)
        : request.aspectRatio || '2:3'
      const [ratioWidth, ratioHeight] = ratio.split(':').map(Number)
      const landscape = ratioWidth >= ratioHeight
      let modelId = profile.modelIdMap?.[request.model.id]
        || (request.model.provider === 'virse' ? request.model.modelId : '')
        || request.model.modelId
        || request.model.id

      if (!modelId) {
        try {
          const modelResult = await this.callTool(profile, 'list_image_models', {}, signal)
          const discoveredMap = matchProviderModels(parseVirseModels(modelResult.data))
          modelId = discoveredMap[request.model.id] || request.model.modelId || request.model.id
        } catch (_) {
          modelId = request.model.modelId || request.model.id
        }
      }
      if (!modelId) {
        throw new Error(`Virse 未找到“${request.model.displayName}”对应的模型 ID`)
      }
      const generated = await this.callTool(profile, 'generate_image', {
        prompt: composePromptWithRoles(request.prompt, request.references),
        model: modelId,
        space_id: spaceId,
        canvas_id: canvasId,
        position_x: 0,
        position_y: 600,
        aspect_ratio: ratio,
        resolution: request.resolution || '2K',
        num_images: request.outputCount || 1,
        asset_id: assetIds.length > 0 ? assetIds : undefined,
        size_width: landscape ? 512 : Math.max(128, Math.round(512 * ratioWidth / ratioHeight)),
        size_height: landscape ? Math.max(128, Math.round(512 * ratioHeight / ratioWidth)) : 512,
      }, signal)

      let urls = collectImageUrls(generated.data)
      const artifactVersionId = findStringField(generated.data, ['artifact_version_id', 'artifactVersionId'])
      if (urls.length === 0 && artifactVersionId) {
        for (let attempt = 0; attempt < 120; attempt += 1) {
          await new Promise<void>((resolve, reject) => {
            if (signal?.aborted) {
              reject(new DOMException('用户已取消', 'AbortError'))
              return
            }
            const onAbort = () => {
              clearTimeout(timeout)
              reject(new DOMException('用户已取消', 'AbortError'))
            }
            const timeout = setTimeout(() => {
              signal?.removeEventListener('abort', onAbort)
              resolve()
            }, 2500)
            signal?.addEventListener('abort', onAbort, { once: true })
          })
          const detail = await this.callTool(profile, 'get_asset_detail', { artifact_version_id: artifactVersionId }, signal)
          const status = findStatus(detail.data)
          if (/^(failed|failure|error|cancelled|canceled|rejected)$/.test(status)) {
            throw new Error(`Virse 生成任务失败：artifact_version_id=${artifactVersionId}, status=${status}`)
          }
          urls = collectImageUrls(detail.data)
          if (urls.length > 0) break
        }
      }

      if (urls.length === 0) {
        throw new Error(artifactVersionId
          ? `Virse 生成超时，请在画布中查看任务 ${artifactVersionId}`
          : 'Virse 已接收请求，但没有返回图片地址或 artifact_version_id')
      }

      const now = Date.now()
      const results: GeneratedImage[] = urls.slice(0, request.outputCount || urls.length).map((url, index) => ({
        id: `gen-virse-${now}-${index}`,
        url,
        mimeType: 'image/png',
        prompt: request.prompt,
        createdAt: now,
      }))
      return { status: 'completed', progress: 100, results }
    } catch (error: any) {
      if (signal?.aborted || error?.name === 'AbortError') return { status: 'cancelled' }
      return {
        status: 'failed',
        error: { message: `Virse 生成失败：${error?.message || error}` },
      }
    }
  }

  private ratioFromReference(request: GenerationRequest): string {
    const first = request.references[0]
    if (!first?.width || !first?.height) return '2:3'
    const ratio = first.width / first.height
    if (ratio > 2.0) return '21:9'
    if (ratio > 1.45) return '16:9'
    if (ratio > 1.15) return '4:3'
    if (ratio > 0.9) return '1:1'
    if (ratio > 0.75) return '4:5'
    if (ratio > 0.6) return '3:4'
    if (ratio > 0.5) return '2:3'
    return '9:16'
  }
}
