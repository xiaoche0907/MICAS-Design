const MAX_IMAGE_BYTES = 40 * 1024 * 1024
const ALLOWED_HOST_SUFFIXES = [
  'aiproxy.vip',
  'apilio.ai',
  'virse.ai',
  'storage.googleapis.com',
  'googleusercontent.com',
  'gstatic.com',
  'cloudfront.net',
  'i.ibb.co',
  'ibb.co',
]

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

const isAllowedImageUrl = (value) => {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
  } catch (_) {
    return false
  }
}

const fetchAllowedImage = async (initialUrl, signal) => {
  let currentUrl = initialUrl
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (!isAllowedImageUrl(currentUrl)) throw new Error('Image host is not allowed')
    const response = await fetch(currentUrl, { redirect: 'manual', signal })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Image redirect is missing a location')
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }
    return response
  }
  throw new Error('Too many image redirects')
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const remoteUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url
  if (!remoteUrl || !isAllowedImageUrl(remoteUrl)) {
    return res.status(400).json({ error: 'Invalid or unsupported image URL' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const upstream = await fetchAllowedImage(remoteUrl, controller.signal)
    if (!upstream.ok) return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` })

    const contentType = upstream.headers.get('content-type') || ''
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(415).json({ error: 'Upstream response is not an image' })
    }

    const declaredSize = Number(upstream.headers.get('content-length') || 0)
    if (declaredSize > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Image is too large' })

    const data = Buffer.from(await upstream.arrayBuffer())
    if (data.byteLength > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Image is too large' })

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', String(data.byteLength))
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.status(200).send(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image proxy failed'
    return res.status(message.includes('abort') ? 504 : 502).json({ error: message })
  } finally {
    clearTimeout(timer)
  }
}
