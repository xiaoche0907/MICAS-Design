/**
 * 图床上传工具。
 * ImgBB/Uploadcare 可由 UI 直连；Freeimage.host 需要 CORS 中转。
 */

export type ImageHostProvider = 'imgbb' | 'uploadcare' | 'freeimage'

interface ImageHostProfile {
  imageHostProvider?: ImageHostProvider
  imgbbApiKey?: string
  uploadcarePublicKey?: string
  freeimageApiKey?: string
}

const TEST_IMAGE = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const IMAGE_RELAY_BASE_URL = 'https://1-sepia-gamma.vercel.app'
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

/**
 * 旧版上传方式：从插件 UI 直接用 multipart/form-data 调用 ImgBB 官方接口。
 * 该路径不依赖插件主进程的 fetch，也不需要部署插件本身。
 */
const uploadImgBBDirect = async (
  image: string,
  apiKey: string,
  name?: string,
  expiration?: number
): Promise<string> => {
  const params = [`key=${encodeURIComponent(apiKey)}`]
  if (expiration) params.push(`expiration=${encodeURIComponent(String(expiration))}`)

  const body = new FormData()
  body.append('image', image)
  if (name?.trim()) body.append('name', name.trim())

  const response = await fetch(`${IMGBB_UPLOAD_URL}?${params.join('&')}`, {
    method: 'POST',
    body,
  })
  return readImgBBResponse(response)
}

const uploadImgBBViaRelay = async (
  image: string,
  apiKey: string,
  name?: string,
  expiration?: number
): Promise<string> => {
  const response = await fetch(IMGBB_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: apiKey,
      image,
      name: name?.trim() || undefined,
      expiration,
    }),
  })
  return readImgBBResponse(response)
}

const uploadFreeimageViaRelay = async (image: string, apiKey: string, name?: string): Promise<string> => {
  const response = await fetch(FREEIMAGE_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: apiKey, source: image, name: name?.trim() || undefined, format: 'json' }),
  })
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
    throw new Error(`Freeimage.host 上传失败（${code}）：${message}`)
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
  expiration?: number
): Promise<string> => {
  if (provider === 'freeimage') return uploadFreeimageViaRelay(image, apiKey, name)

  if (provider === 'uploadcare') {
    const blob = base64ToBlob(image)
    const body = new FormData()
    body.append('UPLOADCARE_PUB_KEY', apiKey)
    body.append('UPLOADCARE_STORE', expiration ? '0' : 'auto')
    body.append('file', blob, name?.trim() || 'micas-image.png')
    try {
      const response = await fetch(UPLOADCARE_UPLOAD_URL, { method: 'POST', body })
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

  let relayError: ImgBBRequestError
  try {
    return await uploadImgBBViaRelay(image, apiKey, name, expiration)
  } catch (error: any) {
    relayError = error
  }

  // Key 无效时换出口也不会成功，直接保留明确错误；其余情况恢复旧版官方直传。
  if (relayError.code === 100) {
    throw new Error(`ImgBB API Key 无效（100）：${relayError.message}`)
  }

  try {
    return await uploadImgBBDirect(image, apiKey, name, expiration)
  } catch (directError: any) {
    const relayCode = relayError.code || relayError.status || '网络异常'
    const directCode = directError?.code || directError?.status || '网络异常'
    if (relayError.code === 103 && directError?.code === 103) {
      throw new Error(
        'ImgBB 已同时拒绝中转和官方直传（103）。这不是 URL 错误；请更换新的 ImgBB API Key，'
        + '若仍返回 103，请切换到 Uploadcare。'
      )
    }
    throw new Error(
      `ImgBB 上传失败：中转（${relayCode}）${relayError.message || '连接失败'}；`
      + `官方直传（${directCode}）${directError?.message || '连接失败'}`
    )
  }
}

/** 将 Base64 图片上传到当前图床，返回 HTTPS 公网直链。 */
export async function uploadToImageHost(
  imageData: string,
  provider: ImageHostProvider,
  apiKey: string,
  name?: string
): Promise<string> {
  const normalizedKey = apiKey.trim()
  if (!normalizedKey) {
    throw new Error(`未配置 ${getImageHostDisplayName(provider)} ${getImageHostCredentialLabel(provider)}`)
  }
  if (/^https?:\/\//i.test(imageData)) return imageData

  const uploadData = provider === 'imgbb' && imageData.includes('base64,')
    ? imageData.split('base64,')[1]
    : imageData
  return requestImageHostUpload(provider, uploadData, normalizedKey, name)
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
    provider === 'imgbb' ? 60 : 1
  )
}
