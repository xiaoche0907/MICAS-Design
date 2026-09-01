/**
 * 图床上传工具。
 * Uploadcare 可由 UI 直连；ImgBB 直连优先并以 CX Working 中转兜底；
 * Freeimage.host 走 CX Working CORS 中转。
 */

export type ImageHostProvider = 'imgbb' | 'uploadcare' | 'freeimage'

export interface ImageHostProfile {
  imageHostProvider?: ImageHostProvider
  imgbbApiKey?: string
  uploadcarePublicKey?: string
  freeimageApiKey?: string
}

const TEST_IMAGE = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const IMAGE_RELAY_BASE_URL = 'https://www.cxworking.xyz'
const IMGBB_RELAY_URL = `${IMAGE_RELAY_BASE_URL}/api/imgbb`
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'
const FREEIMAGE_RELAY_URL = `${IMAGE_RELAY_BASE_URL}/api/freeimage`
const UPLOADCARE_UPLOAD_URL = 'https://upload.uploadcare.com/base/'

export const getImageHostProvider = (profile: ImageHostProfile): ImageHostProvider => (
  profile.imageHostProvider === 'uploadcare' || profile.imageHostProvider === 'freeimage'
    ? profile.imageHostProvider
    : 'imgbb'
)

export const getImageHostApiKey = (profile: ImageHostProfile): string => (
  getImageHostProvider(profile) === 'uploadcare'
    ? profile.uploadcarePublicKey?.trim() || ''
    : getImageHostProvider(profile) === 'freeimage'
      ? profile.freeimageApiKey?.trim() || ''
      : profile.imgbbApiKey?.trim() || ''
)

export const getImageHostDisplayName = (provider: ImageHostProvider): string => (
  provider === 'uploadcare' ? 'Uploadcare' : provider === 'freeimage' ? 'Freeimage.host' : 'ImgBB'
)

export const getImageHostCredentialLabel = (provider: ImageHostProvider): string => (
  provider === 'uploadcare' ? 'Public Key' : 'API Key'
)

const parseJson = (raw: string): any => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

interface ImgBBRequestError extends Error {
  code?: number
  status?: number
}

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> => {
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  if (externalSignal?.aborted) controller.abort()
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (externalSignal?.aborted) throw new DOMException('用户已取消', 'AbortError')
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abortFromCaller)
  }
}

const uploadImgBBDirect = async (
  image: string,
  apiKey: string,
  name?: string,
  expiration?: number,
  timeoutMs = 65000,
  signal?: AbortSignal
): Promise<string> => {
  const query = new URLSearchParams({ key: apiKey })
  if (expiration && expiration >= 60) query.set('expiration', String(expiration))
  const body = new FormData()
  body.append('image', image)
  if (name?.trim()) body.append('name', name.trim().slice(0, 128))
  const response = await fetchWithTimeout(`${IMGBB_UPLOAD_URL}?${query.toString()}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
  }, timeoutMs, signal)
  return readImgBBResponse(response)
}

const readImgBBResponse = async (response: Response): Promise<string> => {
  const raw = await response.text()
  const result = parseJson(raw)
  const uploadedUrl = typeof result?.data?.url === 'string'
    ? result.data.url.replace(/^http:\/\//i, 'https://')
    : ''
  if (response.ok && uploadedUrl) return uploadedUrl

  const error = new Error(
    result?.error?.message
    || result?.status_txt
    || raw
    || `HTTP ${response.status}`
  ) as ImgBBRequestError
  error.code = Number(result?.error?.code || result?.status_code || result?.status) || response.status
  error.status = response.status
  throw error
}

const uploadImgBBViaRelay = async (
  image: string,
  apiKey: string,
  name?: string,
  expiration?: number,
  timeoutMs = 65000,
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetchWithTimeout(IMGBB_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: apiKey,
      image,
      name: name?.trim() || undefined,
      expiration,
    }),
  }, timeoutMs, signal)
  return readImgBBResponse(response)
}

const uploadFreeimageViaRelay = async (
  image: string,
  apiKey: string,
  name?: string,
  timeoutMs = 65000,
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetchWithTimeout(FREEIMAGE_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: apiKey, source: image, name: name?.trim() || undefined, format: 'json' }),
  }, timeoutMs, signal)
  const raw = await response.text()
  const result = parseJson(raw)
  const uploadedUrl = typeof result?.image?.url === 'string'
    ? result.image.url.replace(/^http:\/\//i, 'https://')
    : typeof result?.image?.display_url === 'string'
      ? result.image.display_url.replace(/^http:\/\//i, 'https://')
      : ''
  if (!response.ok || !uploadedUrl) {
    const code = Number(result?.error?.code || result?.status_code || result?.status) || response.status
    const message = result?.error?.message || result?.status_txt || `HTTP ${response.status}`
    const error = new Error(`Freeimage.host 上传失败（${code}）：${message}`) as ImgBBRequestError
    error.code = code
    error.status = response.status
    throw error
  }
  return uploadedUrl
}

const base64ToBlob = (image: string): Blob => {
  const match = image.match(/^data:([^;,]+);base64,(.+)$/i)
  const mimeType = match?.[1] || 'image/png'
  const encoded = match?.[2] || image
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

const requestImageHostUpload = async (
  provider: ImageHostProvider,
  image: string,
  apiKey: string,
  name?: string,
  expiration?: number,
  timeoutMs = 65000,
  signal?: AbortSignal
): Promise<string> => {
  if (provider === 'freeimage') {
    return uploadFreeimageViaRelay(image, apiKey, name, timeoutMs, signal)
  }

  if (provider === 'uploadcare') {
    const blob = base64ToBlob(image)
    const body = new FormData()
    body.append('UPLOADCARE_PUB_KEY', apiKey)
    body.append('UPLOADCARE_STORE', expiration ? '0' : 'auto')
    body.append('file', blob, name?.trim() || 'micas-image.png')
    try {
      const response = await fetchWithTimeout(UPLOADCARE_UPLOAD_URL, { method: 'POST', body }, timeoutMs, signal)
      const raw = await response.text()
      const result = parseJson(raw)
      const fileId = typeof result?.file === 'string' ? result.file : ''
      if (!response.ok || !fileId) {
        const message = result?.detail || result?.error || raw || `HTTP ${response.status}`
        throw new Error(message)
      }
      return `https://ucarecdn.com/${fileId}/`
    } catch (error: any) {
      throw new Error(`Uploadcare 上传失败：${error?.message || '网络请求被拦截'}`)
    }
  }

  let directError: ImgBBRequestError | null = null
  try {
    return await uploadImgBBDirect(image, apiKey, name, expiration, timeoutMs, signal)
  } catch (error: any) {
    if (signal?.aborted || error?.name === 'AbortError') throw error
    directError = error as ImgBBRequestError
  }

  try {
    return await uploadImgBBViaRelay(image, apiKey, name, expiration, timeoutMs, signal)
  } catch (error: any) {
    if (signal?.aborted || error?.name === 'AbortError') throw error
    const relayError = error as ImgBBRequestError
    const code = relayError.code || directError?.code
    if (code === 100) {
      throw new Error(`ImgBB API Key 无效（100）：${relayError.message}`)
    }
    if (code === 103) {
      throw new Error(
        'ImgBB 直连与 CX Working 中转均被拒绝（错误 103）。'
        + '请检查 ImgBB 账号状态或换用新的 API Key。'
      )
    }
    throw new Error(
      `ImgBB 直连与中转上传均失败：`
      + `直连 ${directError?.message || '连接失败'}；中转 ${relayError.message || '连接失败'}`
    )
  }
}

/** 将 Base64 图片上传到当前图床，返回 HTTPS 公网直链。 */
export async function uploadToImageHost(
  imageData: string,
  provider: ImageHostProvider,
  apiKey: string,
  name?: string,
  signal?: AbortSignal
): Promise<string> {
  const normalizedKey = apiKey.trim()
  if (!normalizedKey) {
    throw new Error(`未配置 ${getImageHostDisplayName(provider)} ${getImageHostCredentialLabel(provider)}`)
  }
  if (/^https?:\/\//i.test(imageData)) return imageData

  const uploadData = provider === 'imgbb' && imageData.includes('base64,')
    ? imageData.split('base64,')[1]
    : imageData
  return requestImageHostUpload(provider, uploadData, normalizedKey, name, undefined, 65000, signal)
}

/** 通过上传一张 1x1 GIF 验证当前图床凭据。 */
export async function testImageHostConnection(
  provider: ImageHostProvider,
  apiKey: string
): Promise<void> {
  const normalizedKey = apiKey.trim()
  if (!normalizedKey) {
    throw new Error(`请先填写 ${getImageHostDisplayName(provider)} ${getImageHostCredentialLabel(provider)}`)
  }
  await requestImageHostUpload(
    provider,
    provider === 'uploadcare' ? `data:image/gif;base64,${TEST_IMAGE}` : TEST_IMAGE,
    normalizedKey,
    'micas-connection-test',
    provider === 'imgbb' ? 60 : 1,
    15000
  )
}
