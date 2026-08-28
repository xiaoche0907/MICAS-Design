const FREEIMAGE_UPLOAD_URL = 'https://freeimage.host/api/1/upload'

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Vary', 'Origin')
}

const parseBody = (body) => {
  if (!body) return {}
  if (typeof body === 'string') {
    try { return JSON.parse(body || '{}') } catch (_) { return {} }
  }
  return body
}

const uploadToFreeimage = async ({ key, source, name, format }) => {
  const apiKey = typeof key === 'string' ? key.trim() : ''
  const image = typeof source === 'string'
    ? source.replace(/^data:[^;]+;base64,/i, '')
    : ''
  if (!apiKey) throw Object.assign(new Error('缺少 Freeimage.host API Key'), { status: 400 })
  if (!image) throw Object.assign(new Error('缺少待上传图片'), { status: 400 })

  const form = new URLSearchParams()
  form.set('key', apiKey)
  form.set('action', 'upload')
  form.set('source', image)
  form.set('format', format === 'txt' || format === 'redirect' ? format : 'json')
  if (typeof name === 'string' && name.trim()) form.set('name', name.trim().slice(0, 128))

  const response = await fetch(FREEIMAGE_UPLOAD_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form.toString(),
  })
  const raw = await response.text()
  let result
  try { result = JSON.parse(raw) } catch (_) {
    throw Object.assign(new Error(raw || `Freeimage.host 返回无效响应（HTTP ${response.status}）`), { status: response.status })
  }
  if (!response.ok || !result?.image?.url) {
    throw Object.assign(
      new Error(result?.error?.message || result?.status_txt || `Freeimage.host 上传失败（HTTP ${response.status}）`),
      { status: response.status, code: Number(result?.error?.code || result?.status_code) || response.status }
    )
  }
  return result
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res)
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'micas-freeimage-relay' })
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }
  try {
    return res.status(200).json(await uploadToFreeimage(parseBody(req.body)))
  } catch (error) {
    const status = Number(error?.status) || 502
    const safeStatus = status >= 400 && status < 600 ? status : 502
    return res.status(safeStatus).json({
      success: false,
      status_code: safeStatus,
      error: { message: error?.message || 'Freeimage relay failed', code: Number(error?.code) || safeStatus },
      status_txt: 'Bad Request',
    })
  }
}
