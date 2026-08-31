const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'

const setCorsHeaders = (res) => {
  // MasterGo plugin iframes use an opaque `null` origin.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Vary', 'Origin')
}

const parseBody = (body) => {
  if (!body) return {}
  if (typeof body === 'string') return JSON.parse(body || '{}')
  return body
}

const normalizeExpiration = (value) => {
  const expiration = Math.floor(Number(value))
  return expiration >= 60 && expiration <= 15552000 ? expiration : undefined
}

const uploadToImgBB = async ({ key, image, name, expiration }) => {
  const apiKey = typeof key === 'string' ? key.trim() : ''
  const cleanImage = typeof image === 'string'
    ? image.replace(/^data:image\/[^;]+;base64,/i, '')
    : ''
  if (!apiKey) {
    const error = new Error('缺少 ImgBB API Key')
    error.status = 400
    throw error
  }
  if (!cleanImage) {
    const error = new Error('缺少待上传图片')
    error.status = 400
    throw error
  }

  const query = new URLSearchParams({ key: apiKey })
  const validExpiration = normalizeExpiration(expiration)
  if (validExpiration) query.set('expiration', String(validExpiration))

  // ImgBB's documented upload contract uses multipart/form-data. In particular,
  // large base64 payloads can be rejected after URL encoding, so let FormData
  // preserve the source exactly and generate the multipart boundary for us.
  const form = new FormData()
  form.set('image', cleanImage)
  if (typeof name === 'string' && name.trim()) {
    form.set('name', name.trim().slice(0, 128))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 65000)
  try {
    const response = await fetch(`${IMGBB_UPLOAD_URL}?${query.toString()}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: form,
      signal: controller.signal,
    })
    const raw = await response.text()
    let result
    try {
      result = JSON.parse(raw)
    } catch (_) {
      const error = new Error(raw || `ImgBB 返回了无效响应（HTTP ${response.status}）`)
      error.status = response.ok ? 502 : response.status
      throw error
    }
    if (!response.ok || !result?.data?.url) {
      const error = new Error(
        result?.error?.message
        || result?.status_txt
        || `ImgBB 上传失败（HTTP ${response.status}）`
      )
      error.status = response.ok ? 502 : response.status
      error.code = Number(result?.error?.code || result?.status_code || result?.status) || response.status
      throw error
    }
    return result
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'micas-imgbb-relay' })
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  try {
    const result = await uploadToImgBB(parseBody(req.body))
    return res.status(200).json(result)
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'AbortError' ? 504 : 502)
    const safeStatus = status >= 400 && status < 600 ? status : 502
    return res.status(safeStatus).json({
      success: false,
      status: safeStatus,
      error: {
        message: error instanceof Error ? error.message : 'ImgBB relay failed',
        code: Number(error?.code) || safeStatus,
      },
    })
  }
}
