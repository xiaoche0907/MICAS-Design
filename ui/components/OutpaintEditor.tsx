import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ReferenceImage } from '../engine/types'
import { CloseIcon, ExpandIcon } from './icons'

type Padding = { top: number; right: number; bottom: number; left: number }
type DragKind = 'move' | 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface OutpaintPayload {
  reference: ReferenceImage
  aspectRatio: string
  prompt: string
  modelId: 'gpt-image-2' | 'nanobanana-2'
  resolution: '1K' | '2K' | '4K'
}

interface OutpaintEditorProps {
  source: ReferenceImage
  isGenerating: boolean
  onCancel: () => void
  onMinimize: () => void
  onGenerate: (payload: OutpaintPayload) => void | Promise<void>
}

const RATIOS: Record<string, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '2:3': 2 / 3,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '4:5': 4 / 5,
  '5:4': 5 / 4,
}

const PRESETS: Record<string, string[]> = {
  通用: ['1:1', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9', '4:5', '5:4'],
  Instagram: ['1:1', '4:5', '9:16'],
  Facebook: ['1:1', '16:9', '9:16'],
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function paddingForRatio(sourceRatio: number, targetRatio: number): Padding {
  if (targetRatio >= sourceRatio) {
    const horizontal = targetRatio / sourceRatio - 1
    return { top: 0, bottom: 0, left: horizontal / 2, right: horizontal / 2 }
  }
  const vertical = sourceRatio / targetRatio - 1
  return { top: vertical / 2, bottom: vertical / 2, left: 0, right: 0 }
}

function ratioLabelFromPadding(source: ReferenceImage, padding: Padding): string {
  const width = (source.width || 1) * (1 + padding.left + padding.right)
  const height = (source.height || 1) * (1 + padding.top + padding.bottom)
  const ratio = width / height
  const preset = Object.entries(RATIOS).find(([, value]) => Math.abs(Math.log(value / ratio)) < 0.012)
  if (preset) return preset[0]
  return `${Math.max(1, Math.round(width))}:${Math.max(1, Math.round(height))}`
}

async function buildOutpaintReference(source: ReferenceImage, padding: Padding): Promise<ReferenceImage> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image()
    next.onload = () => resolve(next)
    next.onerror = () => reject(new Error('无法读取扩图源图片'))
    next.src = source.previewUrl
  })

  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  const rawWidth = sourceWidth * (1 + padding.left + padding.right)
  const rawHeight = sourceHeight * (1 + padding.top + padding.bottom)
  const scale = Math.min(1, 2048 / Math.max(rawWidth, rawHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rawWidth * scale))
  canvas.height = Math.max(1, Math.round(rawHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境不支持扩图画布')

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    image,
    Math.round(sourceWidth * padding.left * scale),
    Math.round(sourceHeight * padding.top * scale),
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale)
  )

  const previewUrl = canvas.toDataURL('image/png')
  const binary = atob(previewUrl.split(',')[1] || '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)

  return {
    id: `outpaint-${Date.now()}`,
    role: 'composition',
    source: 'upload',
    name: `${source.name || 'MICAS 图片'}-扩图布局.png`,
    mimeType: 'image/png',
    previewUrl,
    bytes,
    width: canvas.width,
    height: canvas.height,
    instruction: '透明区域为唯一需要生成和补全的扩图区域；已有非透明图像必须保持不变。',
  }
}

export const OutpaintEditor: React.FC<OutpaintEditorProps> = ({ source, isGenerating, onCancel, onMinimize, onGenerate }) => {
  const sourceRatio = (source.width || 1) / (source.height || 1)
  const [padding, setPadding] = useState<Padding>(() => paddingForRatio(sourceRatio, 1))
  const [selectedRatio, setSelectedRatio] = useState('1:1')
  const [preset, setPreset] = useState('通用')
  const [symmetric, setSymmetric] = useState(false)
  const [instruction, setInstruction] = useState('自然延展原图场景、光线、透视与材质，不改变原图主体')
  const [modelId, setModelId] = useState<'gpt-image-2' | 'nanobanana-2'>('gpt-image-2')
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K')
  const [isPreparing, setIsPreparing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const sourceNodeRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    kind: DragKind
    x: number
    y: number
    padding: Padding
    sourceWidth: number
    sourceHeight: number
  } | null>(null)

  const targetRatio = sourceRatio * (1 + padding.left + padding.right) / (1 + padding.top + padding.bottom)
  const canvasStyle = useMemo(() => {
    const maxWidth = 400
    const maxHeight = 520
    const width = targetRatio >= maxWidth / maxHeight ? maxWidth : maxHeight * targetRatio
    const height = targetRatio >= maxWidth / maxHeight ? maxWidth / targetRatio : maxHeight
    return { width, height }
  }, [targetRatio])

  const sourceStyle = {
    left: `${padding.left / (1 + padding.left + padding.right) * 100}%`,
    top: `${padding.top / (1 + padding.top + padding.bottom) * 100}%`,
    width: `${1 / (1 + padding.left + padding.right) * 100}%`,
    height: `${1 / (1 + padding.top + padding.bottom) * 100}%`,
  }

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = (event.clientX - drag.x) / Math.max(1, drag.sourceWidth)
      const dy = (event.clientY - drag.y) / Math.max(1, drag.sourceHeight)
      const start = drag.padding
      const next = { ...start }

      if (drag.kind === 'move') {
        const horizontal = start.left + start.right
        const vertical = start.top + start.bottom
        next.left = clamp(start.left + dx, 0, horizontal)
        next.right = horizontal - next.left
        next.top = clamp(start.top + dy, 0, vertical)
        next.bottom = vertical - next.top
      } else {
        if (drag.kind.includes('left')) next.left = clamp(start.left - dx, 0, 3)
        if (drag.kind.includes('right')) next.right = clamp(start.right + dx, 0, 3)
        if (drag.kind.includes('top')) next.top = clamp(start.top - dy, 0, 3)
        if (drag.kind.includes('bottom')) next.bottom = clamp(start.bottom + dy, 0, 3)
        if (symmetric) {
          if (drag.kind.includes('left')) next.right = next.left
          if (drag.kind.includes('right')) next.left = next.right
          if (drag.kind.includes('top')) next.bottom = next.top
          if (drag.kind.includes('bottom')) next.top = next.bottom
        }
      }

      setPadding(next)
      setSelectedRatio('自定义')
    }
    const handleUp = () => { dragRef.current = null }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [symmetric])

  const beginDrag = (kind: DragKind, event: React.PointerEvent) => {
    if (isGenerating) return
    event.preventDefault()
    event.stopPropagation()
    const sourceRect = sourceNodeRef.current?.getBoundingClientRect()
    dragRef.current = {
      kind,
      x: event.clientX,
      y: event.clientY,
      padding: { ...padding },
      sourceWidth: sourceRect?.width || 160,
      sourceHeight: sourceRect?.height || 160,
    }
  }

  const selectRatio = (ratio: string) => {
    setSelectedRatio(ratio)
    setPadding(paddingForRatio(sourceRatio, RATIOS[ratio]))
  }

  const submit = async () => {
    if (isPreparing || isGenerating) return
    setIsPreparing(true)
    setLocalError(null)
    try {
      const reference = await buildOutpaintReference(source, padding)
      const aspectRatio = ratioLabelFromPadding(source, padding)
      await onGenerate({
        reference,
        aspectRatio,
        modelId,
        resolution,
        prompt: `执行智能扩图。输出比例为 ${aspectRatio}。严格保留参考图中所有非透明像素、主体身份、服装、产品、构图核心、光线与透视，只生成透明区域并让其与原图无缝连续。不得裁切、缩放、重绘或移动已有内容。补充要求：${instruction.trim() || '自然延展场景'}`,
      })
    } catch (error: any) {
      setLocalError(error?.message || String(error))
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <div className="outpaint-editor">
      <header className="outpaint-header">
        <div><span className="outpaint-brand-icon"><ExpandIcon size={16} /></span><strong>智能扩图</strong><small>拖动画面或边缘控制扩展方向</small></div>
        <button onClick={isGenerating ? onMinimize : onCancel} aria-label={isGenerating ? '后台运行' : '关闭智能扩图'} title={isGenerating ? '缩小到后台任务' : '关闭智能扩图'}>
          {isGenerating ? <span className="outpaint-minimize-glyph">—</span> : <CloseIcon size={15} />}
        </button>
      </header>

      <div className="outpaint-body">
        <div className="outpaint-stage">
          <div className="outpaint-canvas" style={canvasStyle}>
            <div
              ref={sourceNodeRef}
              className="outpaint-source"
              style={sourceStyle}
              onPointerDown={(event) => beginDrag('move', event)}
            >
              <img src={source.previewUrl} alt="智能扩图源图片" draggable={false} />
              <span className="outpaint-move-label">拖动定位</span>
            </div>
            {(['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as DragKind[]).map((kind) => (
              <button key={kind} className={`outpaint-handle ${kind}`} onPointerDown={(event) => beginDrag(kind, event)} aria-label={`扩展 ${kind}`} />
            ))}
            <div className="outpaint-grid-lines"><i /><i /><i /><i /></div>
          </div>
          <span className="outpaint-size-label">目标比例 {ratioLabelFromPadding(source, padding)}</span>
        </div>

        <aside className="outpaint-controls">
          <div className="outpaint-control-head">
            <strong>扩图设置</strong>
            <button className={symmetric ? 'active' : ''} onClick={() => setSymmetric((value) => !value)}>{symmetric ? '等比例开启' : '自由扩展'}</button>
          </div>

          <label className="outpaint-label">预设场景</label>
          <select value={preset} onChange={(event) => setPreset(event.target.value)}>
            {Object.keys(PRESETS).map((name) => <option key={name}>{name}</option>)}
          </select>

          <div className="outpaint-ratios">
            <button className={selectedRatio === '原始比例' ? 'active' : ''} onClick={() => { setSelectedRatio('原始比例'); setPadding({ top: 0, right: 0, bottom: 0, left: 0 }) }}>
              <span className="ratio-shape original" /><strong>原始比例</strong>
            </button>
            {PRESETS[preset].map((ratio) => (
              <button key={ratio} className={selectedRatio === ratio ? 'active' : ''} onClick={() => selectRatio(ratio)}>
                <span className="ratio-shape" style={{ aspectRatio: String(RATIOS[ratio]) }} /><strong>{ratio}</strong>
              </button>
            ))}
            <button className={selectedRatio === '自定义' ? 'active' : ''} onClick={() => setSelectedRatio('自定义')}>
              <span className="ratio-shape custom" /><strong>自定义拖动</strong>
            </button>
          </div>

          <label className="outpaint-label">扩图要求</label>
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />

          <div className="outpaint-tip">透明扩展区将交给 AI 补全；原图会作为锁定内容保留。</div>
          <label className="outpaint-label">扩图模型</label>
          <div className="outpaint-models">
            <button className={modelId === 'gpt-image-2' ? 'active' : ''} onClick={() => setModelId('gpt-image-2')}>
              <span className="outpaint-model-mark">I2</span><span><strong>Image 2</strong><small>默认 · 精准编辑</small></span>
            </button>
            <button className={modelId === 'nanobanana-2' ? 'active' : ''} onClick={() => setModelId('nanobanana-2')}>
              <span className="outpaint-model-mark">N2</span><span><strong>Nanobanana 2</strong><small>自然场景延展</small></span>
            </button>
          </div>
          <div className="outpaint-resolution" aria-label="输出清晰度">
            {(['1K', '2K', '4K'] as const).map((item) => (
              <button key={item} className={resolution === item ? 'active' : ''} onClick={() => setResolution(item)}>{item}</button>
            ))}
          </div>
          {localError && <div className="outpaint-error">{localError}</div>}
          <div className="outpaint-actions">
            <button onClick={onCancel} disabled={isGenerating || isPreparing}>取消</button>
            <button className="primary" onClick={() => void submit()} disabled={isGenerating || isPreparing}>
              {isPreparing ? '准备画布…' : isGenerating ? '生成中…' : '生成扩图'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
