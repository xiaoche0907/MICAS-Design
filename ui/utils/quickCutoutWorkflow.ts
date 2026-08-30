export type LocalCutoutDecision<TOutput> =
  | { kind: 'transparent'; output: TOutput }
  | { kind: 'preserve-white'; reason: string }

export interface QuickCutoutWorkflowDependencies<TSource, TOutput> {
  onPhase?(phase: QuickCutoutPhase): void
  localCutout(source: TSource): Promise<LocalCutoutDecision<TOutput>>
  commit(output: TOutput): Promise<void>
}

export type QuickCutoutPhase = 'analyzing' | 'local' | 'commit'

export type QuickCutoutUiStatus = {
  state: 'idle' | 'working' | 'success' | 'error'
  phase?: QuickCutoutPhase
  message: string
}

/** Compact copy for the existing toolbar button; it never replaces the app root. */
export function formatQuickCutoutButtonStatus(
  status: QuickCutoutUiStatus,
  seconds: number
): { label: string; title: string; busy: boolean } {
  if (status.state === 'idle') return { label: '快速抠图', title: '快速抠图', busy: false }
  if (status.state === 'success') return { label: '抠图完成', title: status.message || '透明 PNG 已完成', busy: false }
  if (status.state === 'error') return { label: '抠图失败', title: status.message || '快速抠图失败', busy: false }
  const phaseLabels: Record<QuickCutoutPhase, string> = {
    analyzing: '识别背景',
    local: '本地抠图',
    commit: '插入画布',
  }
  const phase = status.phase || 'analyzing'
  return {
    label: `${phaseLabels[phase]} ${Math.max(0, Math.floor(seconds))}s`,
    title: status.message || phaseLabels[phase],
    busy: true,
  }
}

const REASON_MESSAGES: Record<string, string> = {
  'subject-background-collision': '白色主体与白色背景相连，无法安全分离',
  'expected-background-mismatch': 'AI 返回的中间背景不符合要求',
  'non-white-background': '检测到非白色背景，需要 AI 预处理',
  'unsupported-background': '背景包含复杂场景或颜色变化',
  'no-background': '没有检测到可移除的背景',
  'mostly-background': '图片主体信息不足，已保留原图',
  'invalid-image': '未能读取有效图片',
  'image-too-large': '图片尺寸超过快速抠图处理上限',
  'post-process-failed': '透明 PNG 后处理失败',
  'AI 返回结果改变了原图比例': 'AI 返回结果改变了原图比例，已停止插入',
}

export function quickCutoutReasonToChinese(reason?: string): string {
  if (!reason) return '快速抠图失败'
  if (REASON_MESSAGES[reason]) return REASON_MESSAGES[reason]
  const lower = reason.toLowerCase()
  if (lower.includes('api key')) return '未配置 API Key，无法处理场景背景'
  if (lower.includes('参考图内容不可用') || lower.includes('图片尺寸无效') || lower.includes('未读取')) return '未读取到可处理的图片'
  if (lower.includes('download') || lower.includes('fetch') || lower.includes('读取') || lower.includes('字节')) return '图片下载或读取失败'
  if (lower.includes('insert') || lower.includes('插图')) return '透明 PNG 插入画布失败'
  if (lower.includes('white') || lower.includes('纯白')) return 'AI 返回的中间背景不符合要求'
  return reason
}

export function scheduleQuickCutoutPreparationTimeout(
  onTimeout: () => void,
  delayMs = 9000,
  timers: {
    set: (callback: () => void, delay: number) => unknown
    clear: (handle: unknown) => void
  } = {
    set: (callback, delay) => setTimeout(callback, delay),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
): () => void {
  let active = true
  const handle = timers.set(() => {
    if (!active) return
    active = false
    onTimeout()
  }, delayMs)
  return () => {
    if (!active) return
    active = false
    timers.clear(handle)
  }
}

export type QuickCutoutWorkflowResult =
  | { status: 'committed'; usedAi: boolean }
  | { status: 'preserved'; reason: string }
  | { status: 'failed'; reason: string }
  | { status: 'ignored' }

/**
 * Single-flight executor for quick cutout.
 *
 * This workflow is deliberately local-only. Quick cutout must never start an
 * image-generation request or consume an API key.
 */
export class QuickCutoutWorkflow {
  private active = false

  get isActive(): boolean {
    return this.active
  }

  async execute<TSource, TOutput>(
    source: TSource,
    dependencies: QuickCutoutWorkflowDependencies<TSource, TOutput>
  ): Promise<QuickCutoutWorkflowResult> {
    if (this.active) return { status: 'ignored' }
    this.active = true
    try {
      dependencies.onPhase?.('analyzing')
      const local = await dependencies.localCutout(source)
      if (local.kind === 'transparent') {
        dependencies.onPhase?.('local')
        dependencies.onPhase?.('commit')
        await dependencies.commit(local.output)
        return { status: 'committed', usedAi: false }
      }
      dependencies.onPhase?.('local')
      return { status: 'preserved', reason: local.reason }
    } catch (error: any) {
      return { status: 'failed', reason: error?.message || String(error) }
    } finally {
      this.active = false
    }
  }
}
