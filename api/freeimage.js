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

const decodeImage = (source) => {
  if (typeof source !== 'string') return null

  const dataUri = source.match(/^data:([^;,]+);base64,(.+)$/is)
  const encoded = (dataUri?.[2] || source).replace(/\s+/g, '')
  if (!encoded || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) return null

  const bytes = Buffer.from(encoded, 'base64')
  if (!bytes.length) return null

  // Sniff the bytes instead of trusting a data-URI supplied by the client.
  // Freeimage/Chevereto is much more reliable when it receives a real file
  // part with the correct MIME type, filename and size.
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { bytes, mime: 'image/png', extension: 'png' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { bytes, mime: 'image/jpeg', extension: 'jpg' }
  }
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a')) {
    return { bytes, mime: 'image/gif', extension: 'gif' }
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { bytes, mime: 'image/webp', extension: 'webp' }
  }
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString('ascii') === 'BM') {
    return { bytes, mime: 'image/bmp', extension: 'bmp' }
  }

  return null
}

const safeFilename = (name, extension) => {
  const base = typeof name === 'string' && name.trim()
    ? name.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/\.[a-z0-9]+$/i, '').slice(0, 100)
    : 'micas-image'
  return `${base || 'micas-image'}.${extension}`
}

const uploadToFreeimage = async ({ key, source, name, format }) => {
  const apiKey = typeof key === 'string' ? key.trim() : ''
  const image = decodeImage(source)
  if (!apiKey) throw Object.assign(new Error('缺少 Freeimage.host API Key'), { status: 400 })
  if (!image) throw Object.assign(new Error('图片 Base64 无效或格式不受支持'), { status: 400, code: 130 })

  const form = new FormData()
  form.set('key', apiKey)
  form.set('action', 'upload')
  form.set('format', format === 'txt' || format === 'redirect' ? format : 'json')
  if (typeof name === 'string' && name.trim()) form.set('name', name.trim().slice(0, 128))
  form.set(
    'source',
    new Blob([image.bytes], { type: image.mime }),
    safeFilename(name, image.extension)
  )

  const response = await fetch(FREEIMAGE_UPLOAD_URL, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
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
