import React, { useMemo, useRef, useState } from 'react'
import { ReferenceImage } from '../engine/types'
import { CloseIcon, TrashIcon, UploadCloudIcon, WardrobeIcon } from './icons'

type GarmentCategory = 'top' | 'bottom' | 'shoes' | 'accessory'

interface GarmentAsset extends ReferenceImage {
  category: GarmentCategory
}

export interface TryOnPayload {
  references: ReferenceImage[]
  prompt: string
  aspectRatio: string
  modelId: 'gpt-image-2' | 'nanobanana-2'
  resolution: '1K' | '2K' | '4K'
}

interface TryOnEditorProps {
  source: ReferenceImage
  isGenerating: boolean
  onCancel: () => void
  onMinimize: () => void
  onGenerate: (payload: TryOnPayload) => void | Promise<void>
}

const MAX_ASSETS = 6

const CATEGORIES: Array<{
  id: GarmentCategory
  title: string
  hint: string
  short: string
}> = [
  { id: 'top', title: '上装', hint: '衬衫、外套、针织、背心', short: '上' },
  { id: 'bottom', title: '下装 / 裙装', hint: '裤子、半裙、连衣裙', short: '下' },
  { id: 'shoes', title: '鞋履', hint: '运动鞋、高跟鞋、靴子', short: '鞋' },
  { id: 'accessory', title: '配饰', hint: '包、帽子、腰带、首饰', short: '饰' },
]

const CATEGORY_INSTRUCTIONS: Record<GarmentCategory, string> = {
  top: '这是上装参考。将其准确穿到人物上半身，保留版型、领型、袖型、材质、颜色、印花与细节。',
  bottom: '这是下装或裙装参考。准确替换人物对应服装，保留廓形、长度、腰线、材质、颜色和细节。',
  shoes: '这是鞋履参考。准确替换人物脚部鞋款，保持鞋型、材质、颜色与比例，并符合脚部透视。',
  accessory: '这是配饰参考。自然佩戴到合理位置，保留结构、材质、颜色、Logo 与关键细节。',
}

function readFile(file: File, category: GarmentCategory): Promise<GarmentAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`))
    reader.onload = () => {
      const previewUrl = String(reader.result || '')
      const image = new Image()
      image.onerror = () => reject(new Error(`${file.name} 不是有效图片`))
      image.onload = () => resolve({
        id: `tryon-${category}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        category,
        role: 'product',
        source: 'upload',
        name: file.name,
        mimeType: file.type || 'image/png',
        previewUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
        instruction: CATEGORY_INSTRUCTIONS[category],
      })
      image.src = previewUrl
    }
    reader.readAsDataURL(file)
  })
}

export const TryOnEditor: React.FC<TryOnEditorProps> = ({ source, isGenerating, onCancel, onMinimize, onGenerate }) => {
  const [assets, setAssets] = useState<GarmentAsset[]>([])
  const [instruction, setInstruction] = useState('服装自然合身，保持人物身份、姿势、身材比例、背景、镜头与光线不变')
  const [aspectRatio, setAspectRatio] = useState('Original')
  const [modelId, setModelId] = useState<'gpt-image-2' | 'nanobanana-2'>('nanobanana-2')
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K')
  const [localError, setLocalError] = useState<string | null>(null)
  const [dragCategory, setDragCategory] = useState<GarmentCategory | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const grouped = useMemo(() => CATEGORIES.reduce((result, category) => {
    result[category.id] = assets.filter((asset) => asset.category === category.id)
    return result
  }, {} as Record<GarmentCategory, GarmentAsset[]>), [assets])

  const addFiles = async (files: File[], category: GarmentCategory) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) {
      setLocalError('请选择图片文件')
      return
    }
    const available = Math.max(0, MAX_ASSETS - assets.length)
    if (!available) {
      setLocalError(`最多添加 ${MAX_ASSETS} 张换装参考图`)
      return
    }
    try {
      const next = await Promise.all(imageFiles.slice(0, available).map((file) => readFile(file, category)))
      setAssets((current) => [...current, ...next])
      setLocalError(imageFiles.length > available ? `已达到 ${MAX_ASSETS} 张参考图上限` : null)
    } catch (error: any) {
      setLocalError(error?.message || String(error))
    }
  }

  const submit = async () => {
    if (isGenerating) return
    if (!assets.length) {
      setLocalError('请至少上传一张需要替换的服装、鞋履或配饰图片')
      return
    }
    setLocalError(null)
    const personReference: ReferenceImage = {
      ...source,
      role: 'model',
      instruction: '这是唯一人物底图。严格保留人物身份、脸部、发型、体型、姿势、手脚、场景、构图、镜头和光线，只替换指定穿搭。',
    }
    const assetSummary = CATEGORIES
      .filter((category) => grouped[category.id].length)
      .map((category) => `${category.title} ${grouped[category.id].length} 张`)
      .join('、')
    await onGenerate({
      references: [personReference, ...assets],
      aspectRatio,
      modelId,
      resolution,
      prompt: `执行高质量 AI 虚拟试穿/换装。Reference Image 1 是人物底图；后续参考图按各自说明分别作为上装、下装或裙装、鞋履、配饰。将指定商品真实、准确地穿戴到人物身上，严格还原商品版型、颜色、材质、纹理、图案、Logo 和结构细节。保持人物身份、脸部、发型、肤色、身材比例、姿势、手脚、背景、构图、相机视角与原始光影不变。衣物应符合人体结构和重力，遮挡、褶皱、阴影、透视自然，不得增加未提供的服饰，不得拼贴、变形或产生多余肢体。本次参考：${assetSummary}。用户补充要求：${instruction.trim() || '自然合身并保留原图内容'}`,
    })
  }

  return (
    <div className="tryon-editor">
      <header className="outpaint-header tryon-header">
        <div><span className="outpaint-brand-icon"><WardrobeIcon size={16} /></span><strong>万物上身</strong><small>上传单品，让当前人物完成自然换装</small></div>
        <button onClick={isGenerating ? onMinimize : onCancel} aria-label={isGenerating ? '后台运行' : '关闭万物上身'}>
          {isGenerating ? <span className="outpaint-minimize-glyph">—</span> : <CloseIcon size={15} />}
        </button>
      </header>

      <div className="tryon-body">
        <section className="tryon-source-panel">
          <div className="tryon-step"><b>01</b><span>人物底图</span><em>已从画布选中</em></div>
          <div className="tryon-source-image">
            <img src={source.previewUrl} alt="人物底图" />
            <span>锁定人物与场景</span>
          </div>
          <div className="tryon-source-tip">生成时仅替换上传的穿搭单品，人物身份、姿势和背景会作为保留内容。</div>
        </section>

        <aside className="tryon-controls">
          <div className="tryon-step"><b>02</b><span>上传换装单品</span><em>{assets.length} / {MAX_ASSETS} 张</em></div>
          <div className="tryon-category-grid">
            {CATEGORIES.map((category) => (
              <div
                key={category.id}
                className={`tryon-category ${dragCategory === category.id ? 'dragging' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragCategory(category.id) }}
                onDragLeave={() => setDragCategory(null)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragCategory(null)
                  void addFiles(Array.from(event.dataTransfer.files), category.id)
                }}
              >
                <div className="tryon-category-head">
                  <span className="tryon-category-mark">{category.short}</span>
                  <span><strong>{category.title}</strong><small>{category.hint}</small></span>
                </div>
                <div className="tryon-thumbs">
                  {grouped[category.id].map((asset) => (
                    <div className="tryon-thumb" key={asset.id}>
                      <img src={asset.previewUrl} alt={asset.name || category.title} />
                      <button onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} aria-label={`删除${asset.name || '参考图'}`}><CloseIcon size={9} /></button>
                    </div>
                  ))}
                  <button className="tryon-add" onClick={() => fileInputs.current[category.id]?.click()} disabled={assets.length >= MAX_ASSETS}>
                    <UploadCloudIcon size={15} /><span>{grouped[category.id].length ? '继续添加' : '上传 / 拖入'}</span>
                  </button>
                </div>
                <input
                  ref={(element) => { fileInputs.current[category.id] = element }}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    void addFiles(Array.from(event.target.files || []), category.id)
                    event.currentTarget.value = ''
                  }}
                />
              </div>
            ))}
          </div>

          <label className="tryon-label">试穿要求（选填）</label>
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：外套敞开穿，保留内搭，整体自然合身…" />

          <div className="tryon-settings-row">
            <label><span>尺寸比例</span><select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}><option value="Original">原始比例</option><option value="2:3">2:3 竖版</option><option value="3:4">3:4 竖版</option><option value="4:5">4:5 社媒</option><option value="1:1">1:1 方形</option></select></label>
          </div>

          <label className="tryon-label">生成模型</label>
          <div className="outpaint-models tryon-models">
            <button className={modelId === 'nanobanana-2' ? 'active' : ''} onClick={() => setModelId('nanobanana-2')}><span className="outpaint-model-mark">N2</span><span><strong>Nanobanana 2</strong><small>推荐 · 多图自然换装</small></span></button>
            <button className={modelId === 'gpt-image-2' ? 'active' : ''} onClick={() => setModelId('gpt-image-2')}><span className="outpaint-model-mark">I2</span><span><strong>Image 2</strong><small>精准材质与细节</small></span></button>
          </div>
          <div className="outpaint-resolution">
            {(['1K', '2K', '4K'] as const).map((item) => <button key={item} className={resolution === item ? 'active' : ''} onClick={() => setResolution(item)}>{item}</button>)}
          </div>

          {localError && <div className="outpaint-error">{localError}</div>}
          <div className="tryon-actions">
            <button className="tryon-clear" onClick={() => setAssets([])} disabled={!assets.length || isGenerating}><TrashIcon size={14} />清空单品</button>
            <button onClick={onCancel} disabled={isGenerating}>取消</button>
            <button className="primary" onClick={() => void submit()} disabled={isGenerating}>{isGenerating ? '生成中…' : '一键 AI 万物上身'}</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
