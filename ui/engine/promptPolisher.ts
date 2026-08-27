import { ApiProfile } from '@messages/sender'

export const PROMPT_POLISH_MODELS = [
  'gpt-5.6-luna',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite-preview',
] as const

export interface PromptPolishFailure {
  model: string
  message: string
}

export interface PromptPolishResult {
  prompt: string
  model: string
  failures: PromptPolishFailure[]
}

let nextStartIndex = 0

function getAgentConfig(profile: ApiProfile): { baseUrl: string; apiKey: string } {
  const baseUrl = (
    profile.agentBaseUrl
    || (profile.provider === 'apilio' ? profile.baseUrl : '')
  ).trim()
  const apiKey = (
    profile.agentApiKey
    || (profile.provider === 'apilio' ? profile.apiKey : '')
  ).trim()

  if (!baseUrl || !apiKey) {
    throw new Error('请先在“设置 → 智能体”中配置柏拉图 Base URL 和 API Key')
  }
  return { baseUrl, apiKey }
}

function buildChatEndpoint(baseUrl: string): string {
  const normalized = baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1\/chat\/completions$/i, '')
  return /\/v1$/i.test(normalized)
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`
}

function extractText(data: any): string {
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((part: any) => typeof part === 'string' ? part : part?.text || '')
      .join('')
      .trim()
  }
  if (typeof data?.output_text === 'string') return data.output_text.trim()
  if (typeof data?.text === 'string') return data.text.trim()
  return ''
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function polishPrompt(
  sourcePrompt: string,
  profile: ApiProfile
): Promise<PromptPolishResult> {
  const prompt = sourcePrompt.trim()
  if (!prompt) throw new Error('请先输入需要润色的提示词')

  const { baseUrl, apiKey } = getAgentConfig(profile)
  const endpoint = buildChatEndpoint(baseUrl)
  const failures: PromptPolishFailure[] = []
  const startIndex = nextStartIndex
  nextStartIndex = (nextStartIndex + 1) % PROMPT_POLISH_MODELS.length
  const models = PROMPT_POLISH_MODELS.map((_, offset) => (
    PROMPT_POLISH_MODELS[(startIndex + offset) % PROMPT_POLISH_MODELS.length]
  ))

  for (const model of models) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 45000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.45,
          messages: [
            {
              role: 'system',
              content: [
                '你是专业的 AI 图片提示词润色智能体。',
                '保留用户原意、主体、数量、服装、材质、场景和限制条件，不虚构商品事实。',
                '补充清晰的构图、光线、镜头、材质和商业视觉细节，使提示词可直接用于图片生成或改图。',
                '保持用户原本语言，只输出润色后的最终提示词，不解释、不加标题、不使用 Markdown。',
              ].join(''),
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 260)
        throw new Error(`HTTP ${response.status}${detail ? `：${detail}` : ''}`)
      }

      const polished = extractText(await response.json())
      if (!polished) throw new Error('接口返回成功，但没有可用的润色文本')
      return { prompt: polished, model, failures }
    } catch (error) {
      failures.push({
        model,
        message: error instanceof DOMException && error.name === 'AbortError'
          ? '请求超过 45 秒已取消'
          : getErrorMessage(error),
      })
      // 不等待、不重试当前模型，立即进入下一个模型。
    } finally {
      window.clearTimeout(timeout)
    }
  }

  throw new Error(`三个润色模型均异常：${failures.map((item) => `${item.model}（${item.message}）`).join('；')}`)
}
