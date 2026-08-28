import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ReferenceImage } from '../engine/types'
import { CloseIcon, TrashIcon, UploadCloudIcon, WardrobeIcon } from './icons'

type GarmentCategory = 'top' | 'bottom' | 'shoes' | 'accessory'
type ProductPurpose = 'main' | 'support'
type ProductView = 'front' | 'back' | 'side' | 'detail'
type AssetPickerState = { assetId: string; field: 'purpose' | 'view' } | null

interface GarmentAsset extends ReferenceImage {
  category: GarmentCategory
  purpose: ProductPurpose
  view: ProductView
}

export interface TryOnPayload {
  references: ReferenceImage[]
  prompt: string
  aspectRatio: string
  modelId: 'gpt-image-2' | 'nanobanana-2'
  resolution: '1K' | '2K' | '4K'
  poseLocked: boolean
}

interface TryOnEditorProps {
  source: ReferenceImage
  isGenerating: boolean
  onCancel: () => void
  onMinimize: () => void
  onGenerate: (payload: TryOnPayload) => void | Promise<void>
}

const MAX_ASSETS = 6

const PURPOSE_OPTIONS: Array<{ id: ProductPurpose; label: string; instruction: string }> = [
  { id: 'main', label: '主', instruction: '主产品：这是本次换装的核心商品，优先级最高，必须准确穿戴且完整保留其设计特征' },
  { id: 'support', label: '搭', instruction: '搭配产品：作为辅助搭配准确穿戴，不得抢占、替换或改变主产品' },
]

const VIEW_OPTIONS: Array<{ id: ProductView; label: string; instruction: string }> = [
  { id: 'front', label: '正面', instruction: '正面视图：用于识别商品正面版型、门襟、领口、图案与结构' },
  { id: 'back', label: '背面', instruction: '背面视图：用于补充同一商品的背部结构，不代表另一件商品' },
  { id: 'side', label: '侧面', instruction: '侧面视图：用于补充同一商品的侧面轮廓与厚度，不代表另一件商品' },
  { id: 'detail', label: '特写', instruction: '细节特写：只用于补充同一商品的材质、纹理、五金和工艺，不得单独生成或重复穿戴' },
]

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
        purpose: 'support',
        view: 'front',
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
  const [poseLocked, setPoseLocked] = useState(true)
  const [hoverCategory, setHoverCategory] = useState<GarmentCategory | null>(null)
  const [pasteFeedbackCategory, setPasteFeedbackCategory] = useState<GarmentCategory | null>(null)
  const [assetPicker, setAssetPicker] = useState<AssetPickerState>(null)
  const [modelId, setModelId] = useState<'gpt-image-2' | 'nanobanana-2'>('nanobanana-2')
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K')
  const [localError, setLocalError] = useState<string | null>(null)
  const [dragCategory, setDragCategory] = useState<GarmentCategory | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const assetsRef = useRef<GarmentAsset[]>([])
  const addQueueRef = useRef<Promise<{ added: number }>>(Promise.resolve({ added: 0 }))
  const feedbackTimerRef = useRef<number | null>(null)
  const pickerDialogRef = useRef<HTMLDivElement | null>(null)
  const pickerOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const pickerTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    assetsRef.current = assets
  }, [assets])

  const grouped = useMemo(() => CATEGORIES.reduce((result, category) => {
    result[category.id] = assets.filter((asset) => asset.category === category.id)
    return result
  }, {} as Record<GarmentCategory, GarmentAsset[]>), [assets])

  const getAssetInstruction = (asset: GarmentAsset) => {
    const purpose = PURPOSE_OPTIONS.find((option) => option.id === asset.purpose) || PURPOSE_OPTIONS[1]
    const view = VIEW_OPTIONS.find((option) => option.id === asset.view) || VIEW_OPTIONS[0]
    return `${CATEGORY_INSTRUCTIONS[asset.category]} ${purpose.instruction}。${view.instruction}。`
  }

  const updateAsset = (id: string, patch: Partial<Pick<GarmentAsset, 'purpose' | 'view'>>) => {
    setAssets((current) => {
      const updated = current.map((asset) => asset.id === id ? { ...asset, ...patch } : asset)
      assetsRef.current = updated
      return updated
    })
  }

  const addFiles = (files: File[], category: GarmentCategory): Promise<{ added: number }> => {
    const task = addQueueRef.current.then(async () => {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      if (!imageFiles.length) {
        setLocalError('请选择图片文件')
        return { added: 0 }
      }
      const current = assetsRef.current
      const available = Math.max(0, MAX_ASSETS - current.length)
      if (!available) {
        setLocalError(`最多添加 ${MAX_ASSETS} 张换装参考图`)
        return { added: 0 }
      }
      const filesToRead = imageFiles.slice(0, available)
      try {
        const next = await Promise.all(filesToRead.map((file) => readFile(file, category)))
        const latest = assetsRef.current
        const room = Math.max(0, MAX_ASSETS - latest.length)
        const accepted = next.slice(0, room).map((asset, index) => ({
          ...asset,
          purpose: latest.length === 0 && index === 0 ? 'main' as const : 'support' as const,
        }))
        const updated = [...latest, ...accepted].slice(0, MAX_ASSETS)
        assetsRef.current = updated
        setAssets(updated)
        setLocalError(imageFiles.length > available ? `已达到 ${MAX_ASSETS} 张参考图上限` : null)
        return { added: accepted.length }
      } catch (error: any) {
        setLocalError(error?.message || String(error))
        return { added: 0 }
      }
    })
    addQueueRef.current = task.catch(() => ({ added: 0 }))
    return task
  }

  useEffect(() => {
    // TypeScript's older DOM lib does not include `paste` in WindowEventMap;
    // receive a generic Event and narrow it at runtime instead.
    const handlePaste = (event: Event) => {
      const clipboardEvent = event as ClipboardEvent
      const files = Array.from(clipboardEvent.clipboardData?.items || [])
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (!files.length) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (isGenerating) {
        setLocalError('生成中无法粘贴图片')
        return
      }
      const targetCategory = hoverCategory
      if (!targetCategory) {
        setLocalError('请先将鼠标移到要粘贴的分类卡片上')
        return
      }
      void addFiles(files, targetCategory).then((result) => {
        if (!result.added) return
        if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
        setPasteFeedbackCategory(targetCategory)
        feedbackTimerRef.current = window.setTimeout(() => setPasteFeedbackCategory(null), 700)
      })
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [hoverCategory, isGenerating])

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
  }, [])

  useEffect(() => {
    if (!assetPicker) return
    const key = `${assetPicker.assetId}-${assetPicker.field}`
    const focusCurrent = () => pickerOptionRefs.current[key]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePicker()
        return
      }
      if (event.key !== 'Tab' || !pickerDialogRef.current) return
      const focusable = Array.from(pickerDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const frame = window.requestAnimationFrame(focusCurrent)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [assetPicker])

  const closePicker = () => {
    setAssetPicker(null)
    window.requestAnimationFrame(() => pickerTriggerRef.current?.focus())
  }

  const openPicker = (asset: GarmentAsset, field: 'purpose' | 'view', trigger: HTMLButtonElement) => {
    pickerTriggerRef.current = trigger
    setAssetPicker({ assetId: asset.id, field })
  }

  const submit = async () => {
    if (isGenerating) return
    if (!assets.length) {
      setLocalError('请至少上传一张需要替换的服装、鞋履或配饰图片')
      return
    }
    setLocalError(null)
    const poseLockInstruction = poseLocked
      ? '【姿态与取景锁定（最高优先级）】输出必须与人物底图保持完全相同的画布比例、裁切边界、相机距离、构图、人物位置、身体姿态、手脚姿势和可见身体范围。人物底图若只展示下半身、上半身或任何局部，输出也必须只展示相同局部；严禁向上、向下或向两侧扩图，严禁补画原图画面外的头部、上半身、下半身、腿脚或背景，严禁为了完整展示商品而改变镜头或补全人物。商品超出人物底图可见范围的部分必须自然保持在画面外。'
      : '可在保持人物身份与自然人体结构的前提下，根据用户要求适度调整姿态和构图。'
    const personReference: ReferenceImage = {
      ...source,
      role: 'model',
      instruction: `这是唯一人物底图。严格保留人物身份、脸部、发型、体型、场景和光线，只替换指定穿搭。${poseLockInstruction}`,
    }
    const annotatedAssets: ReferenceImage[] = assets.map((asset) => ({
      ...asset,
      instruction: getAssetInstruction(asset),
    }))
    const assetSummary = CATEGORIES
      .filter((category) => grouped[category.id].length)
      .map((category) => `${category.title}：${grouped[category.id].map((asset) => {
        const purpose = PURPOSE_OPTIONS.find((option) => option.id === asset.purpose)?.label
        const view = VIEW_OPTIONS.find((option) => option.id === asset.view)?.label
        return `${purpose}/${view}`
      }).join('、')}`)
      .join('、')
    await onGenerate({
      references: [personReference, ...annotatedAssets],
      aspectRatio: poseLocked ? 'Original' : aspectRatio,
      modelId,
      resolution,
      poseLocked,
      prompt: `执行高质量 AI 虚拟试穿/换装。Reference Image 1 是唯一人物底图；后续参考图按各自说明分别作为上装、下装或裙装、鞋履、配饰。每张商品图同时带有“主/搭”用途标识和“正面/背面/侧面/特写”视角标识。主产品是核心换装商品，搭配产品是辅助单品；同一用途下的背面、侧面和特写是同一商品的补充信息，必须融合用于还原商品，绝不能被当作不同商品重复穿戴。将指定商品真实、准确地穿戴到人物身上，严格还原商品版型、颜色、材质、纹理、图案、Logo 和结构细节。${poseLockInstruction} 衣物应符合人体结构和重力，遮挡、褶皱、阴影、透视自然，不得增加未提供的服饰，不得拼贴、变形或产生多余肢体。本次参考标识：${assetSummary}。用户补充要求：${instruction.trim() || '自然合身并保留原图内容'}`,
    })
  }

  const selectedPickerAsset = assetPicker ? assets.find((asset) => asset.id === assetPicker.assetId) : null
  const pickerOptions = assetPicker?.field === 'purpose' ? PURPOSE_OPTIONS : VIEW_OPTIONS

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
          <button
            type="button"
            className={`tryon-pose-lock ${poseLocked ? 'active' : ''}`}
            onClick={() => {
              setPoseLocked((current) => !current)
              if (!poseLocked) setAspectRatio('Original')
            }}
            aria-pressed={poseLocked}
          >
            <span>姿态锁定</span><strong>{poseLocked ? 'ON' : 'OFF'}</strong>
          </button>
          <div className="tryon-source-image">
            <img src={source.previewUrl} alt="人物底图" />
            <span>锁定人物与场景</span>
          </div>
          <div className="tryon-source-tip">{poseLocked ? '已锁定原图比例、裁切、镜头和可见身体范围；局部人物图不会被扩展或补全。' : '生成时保留人物身份与场景，但允许根据商品适度调整姿态和构图。'}</div>
        </section>

        <aside className="tryon-controls">
          <div className="tryon-step"><b>02</b><span>上传换装单品</span><em>{assets.length} / {MAX_ASSETS} 张</em></div>
          <div className="tryon-paste-bar" aria-live="polite">
            <span>{pasteFeedbackCategory ? `已粘贴到：${CATEGORIES.find((category) => category.id === pasteFeedbackCategory)?.title || ''}` : hoverCategory ? `当前粘贴到：${CATEGORIES.find((category) => category.id === hoverCategory)?.title || ''}` : '把鼠标移到分类卡片后按 Ctrl+V'}</span>
          </div>
          <div className="tryon-category-grid">
            {CATEGORIES.map((category) => (
              <div
                key={category.id}
                className={`tryon-category ${hoverCategory === category.id ? 'paste-target' : ''} ${pasteFeedbackCategory === category.id ? 'paste-success' : ''} ${dragCategory === category.id ? 'dragging' : ''}`}
                onPointerEnter={() => setHoverCategory(category.id)}
                onPointerLeave={() => setHoverCategory((current) => current === category.id ? null : current)}
                onFocusCapture={() => setHoverCategory(category.id)}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setHoverCategory((current) => current === category.id ? null : current)
                  }
                }}
                aria-label={`${category.title}，鼠标移到这里后按 Ctrl+V 粘贴图片`}
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
                    <div className="tryon-asset" key={asset.id}>
                      <div className="tryon-thumb">
                        <img src={asset.previewUrl} alt={asset.name || category.title} />
                        <span className={`tryon-purpose-badge ${asset.purpose}`}>{asset.purpose === 'main' ? '主' : '搭'}</span>
                        <span className="tryon-view-badge">{VIEW_OPTIONS.find((option) => option.id === asset.view)?.label}</span>
                        <button onClick={() => setAssets((current) => { const updated = current.filter((item) => item.id !== asset.id); assetsRef.current = updated; return updated })} aria-label={`删除${asset.name || '参考图'}`}><CloseIcon size={9} /></button>
                      </div>
                      <div className="tryon-asset-tags">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-expanded={assetPicker?.assetId === asset.id && assetPicker.field === 'purpose'}
                          aria-label={`${asset.name || category.title}，用途：${PURPOSE_OPTIONS.find((option) => option.id === asset.purpose)?.label}`}
                          onClick={(event) => openPicker(asset, 'purpose', event.currentTarget)}
                        >{PURPOSE_OPTIONS.find((option) => option.id === asset.purpose)?.label}</button>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-expanded={assetPicker?.assetId === asset.id && assetPicker.field === 'view'}
                          aria-label={`${asset.name || category.title}，视角：${VIEW_OPTIONS.find((option) => option.id === asset.view)?.label}`}
                          onClick={(event) => openPicker(asset, 'view', event.currentTarget)}
                        >{VIEW_OPTIONS.find((option) => option.id === asset.view)?.label}</button>
                      </div>
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
            <label><span>尺寸比例</span><select value={poseLocked ? 'Original' : aspectRatio} disabled={poseLocked} onChange={(event) => setAspectRatio(event.target.value)}><option value="Original">原始比例</option><option value="2:3">2:3 竖版</option><option value="3:4">3:4 竖版</option><option value="4:5">4:5 社媒</option><option value="1:1">1:1 方形</option></select></label>
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
            <button className="tryon-clear" onClick={() => { assetsRef.current = []; setAssets([]) }} disabled={!assets.length || isGenerating}><TrashIcon size={14} />清空单品</button>
            <button onClick={onCancel} disabled={isGenerating}>取消</button>
            <button className="primary" onClick={() => void submit()} disabled={isGenerating}>{isGenerating ? '生成中…' : '一键 AI 万物上身'}</button>
          </div>
        </aside>
      </div>
      {assetPicker && selectedPickerAsset && (
        <div className="tryon-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker() }}>
          <div
            ref={pickerDialogRef}
            className="tryon-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tryon-picker-title"
          >
            <div className="tryon-picker-header">
              <div className="tryon-picker-product">
                <img src={selectedPickerAsset.previewUrl} alt="" />
                <span>{selectedPickerAsset.name}</span>
              </div>
              <button type="button" onClick={closePicker} aria-label="关闭"><CloseIcon size={14} /></button>
            </div>
            <h2 id="tryon-picker-title">{assetPicker.field === 'purpose' ? '选择产品用途' : '选择产品视角'}</h2>
            <p>{assetPicker.field === 'purpose' ? '主产品是本次换装的核心单品，搭配产品用于辅助搭配。' : '选择这张图片展示的角度，帮助 AI 还原同一件商品。'}</p>
            <div className="tryon-picker-options">
              {pickerOptions.map((option) => {
                const selected = selectedPickerAsset[assetPicker.field] === option.id
                return (
                  <button
                    type="button"
                    key={option.id}
                    ref={(element) => { pickerOptionRefs.current[`${selectedPickerAsset.id}-${assetPicker.field}`] = selected ? element : pickerOptionRefs.current[`${selectedPickerAsset.id}-${assetPicker.field}`] }}
                    className={selected ? 'active' : ''}
                    onClick={() => {
                      updateAsset(selectedPickerAsset.id, { [assetPicker.field]: option.id } as Partial<Pick<GarmentAsset, 'purpose' | 'view'>>)
                      closePicker()
                    }}
                  >
                    <span><strong>{option.label}</strong><small>{option.instruction}</small></span>
                    {selected && <span className="tryon-picker-check">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
