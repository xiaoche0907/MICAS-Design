const VIRSE_PROTOCOL_VERSION = '2025-03-26'
const VIRSE_BASE_URLS = new Set(['https://api.virse.ai', 'https://dev.virse.ai'])
const ALLOWED_TOOLS = new Set([
  'get_account',
  'list_workspaces',
  'list_image_models',
  'generate_image',
  'get_asset_detail',
  'get_element',
  'upload_image',
  'get_upload_token',
])

const setCorsHeaders = (res) => {
  // MasterGo plugin iframes use an opaque `null` origin, so wildcard CORS is required.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Vary', 'Origin')
}

const normalizeBaseUrl = (value) => {
  const normalized = String(value || 'https://api.virse.ai')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/mcp$/i, '')
  if (!VIRSE_BASE_URLS.has(normalized)) {
    const error = new Error('不支持的 Virse API 节点')
    error.status = 400
    throw error
  }
  return normalized
}

const parseMcpResponse = (raw, contentType = '') => {
  if (!raw) return {}
  if (contentType.includes('text/event-stream')) {
    let lastMessage = {}
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue
      try {
        lastMessage = JSON.parse(line.slice(5).trim())
      } catch (_) {
        // Ignore SSE keep-alives and non-JSON events.
      }
    }
    return lastMessage
  }
  return JSON.parse(raw)
}

const postMcp = async (baseUrl, body, apiKey, sessionId = '') => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 65000)
  try {
    const headers = {
      Accept: 'application/json, text/event-stream;q=0.9',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    if (sessionId) headers['mcp-session-id'] = sessionId
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) {
      const error = new Error(raw || `Virse returned HTTP ${response.status}`)
      error.status = response.status
      throw error
    }
    return {
      data: parseMcpResponse(raw, response.headers.get('content-type') || ''),
      sessionId: response.headers.get('mcp-session-id') || sessionId,
    }
  } finally {
    clearTimeout(timeout)
  }
}

const parseTextPayload = (texts) => {
  if (texts.length !== 1) return texts
  try {
    return JSON.parse(texts[0])
  } catch (_) {
    return texts[0]
  }
}

const callVirseTool = async ({ apiKey, baseUrl, tool, args = {} }) => {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    const error = new Error('缺少 Virse API Key')
    error.status = 400
    throw error
  }
  if (!ALLOWED_TOOLS.has(tool)) {
    const error = new Error('不支持的 Virse 工具')
    error.status = 400
    throw error
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const initialized = await postMcp(normalizedBaseUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: VIRSE_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'micas-design-relay', version: '1.0.0' },
    },
  }, apiKey.trim())
  if (initialized.data?.error) {
    throw new Error(initialized.data.error.message || 'Virse MCP 初始化失败')
  }

  await postMcp(normalizedBaseUrl, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }, apiKey.trim(), initialized.sessionId)

  const called = await postMcp(normalizedBaseUrl, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: tool, arguments: args },
  }, apiKey.trim(), initialized.sessionId)
  if (called.data?.error) throw new Error(called.data.error.message || `Virse ${tool} 调用失败`)

  const result = called.data?.result || {}
  if (result.isError) {
    const message = result.content?.find((item) => item?.type === 'text')?.text
    throw new Error(message || `Virse ${tool} 返回错误`)
  }
  const texts = (result.content || [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
  const structured = result.structuredContent ?? result.structured_content ?? result.data
  return {
    data: structured !== undefined ? structured : parseTextPayload(texts),
    content: result.content || [],
  }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const result = await callVirseTool(body)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(result)
  } catch (error) {
    const status = Number(error?.status) || 502
    const safeStatus = status >= 400 && status < 600 ? status : 502
    return res.status(safeStatus).json({
      error: error instanceof Error ? error.message : 'Virse request failed',
    })
  }
}

