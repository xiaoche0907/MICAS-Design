import React, { useMemo, useRef } from 'react'
import { AssetCategory, AssetLibraryItem } from '@messages/sender'
import { ArrowLeftIcon, PlusIcon, SearchIcon, TrashIcon } from './icons'

export interface AssetCandidate {
  name: string
  previewUrl: string
  mimeType: string
  width?: number
  height?: number
  source: AssetLibraryItem['source']
  suggestedCategory: AssetCategory
}

interface AssetLibraryPageProps {
  assets: AssetLibraryItem[]
  activeCategory: AssetCategory
  search: string
  onBack: () => void
  onCategoryChange: (category: AssetCategory) => void
  onSearchChange: (value: string) => void
  onFilesSelected: (files: FileList) => void
  onUseAsset: (asset: AssetLibraryItem) => void
  onInsertAsset: (asset: AssetLibraryItem) => void
  onDeleteAsset: (asset: AssetLibraryItem) => void
}

const categories: Array<{
  id: AssetCategory
  label: string
  shortLabel: string
  description: string
  mark: string
}> = [
  { id: 'brand', label: '品牌素材', shortLabel: '品牌', description: 'Logo、产品与品牌视觉', mark: '牌' },
  { id: 'model', label: '模特库', shortLabel: '模特', description: '人物形象与固定模特', mark: '模' },
  { id: 'outfit', label: '搭配库', shortLabel: '搭配', description: '完整造型与穿搭方案', mark: '搭' },
]

export const AssetLibraryPage: React.FC<AssetLibraryPageProps> = ({
  assets,
  activeCategory,
  search,
  onBack,
  onCategoryChange,
  onSearchChange,
  onFilesSelected,
  onUseAsset,
  onInsertAsset,
  onDeleteAsset,
}) => {
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const normalizedSearch = search.trim().toLowerCase()
  const visibleAssets = useMemo(() => assets.filter((asset) => (
    asset.category === activeCategory
    && (!normalizedSearch || asset.name.toLowerCase().includes(normalizedSearch))
  )), [assets, activeCategory, normalizedSearch])
  const currentCategory = categories.find((item) => item.id === activeCategory) || categories[0]

  return (
    <main className="asset-library-page">
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) onFilesSelected(event.target.files)
          event.target.value = ''
        }}
      />

      <header className="asset-library-header">
        <button className="asset-library-back" onClick={onBack} aria-label="返回主编辑页">
          <ArrowLeftIcon size={16} />
        </button>
        <div>
          <strong>MICAS 资产库</strong>
          <small>集中管理可复用的品牌、模特与搭配素材</small>
        </div>
        <span className="asset-library-total">{assets.length}</span>
      </header>

      <nav className="asset-library-tabs" aria-label="资产分类">
        {categories.map((category) => {
          const count = assets.filter((asset) => asset.category === category.id).length
          return (
            <button
              key={category.id}
              className={activeCategory === category.id ? 'active' : ''}
              aria-pressed={activeCategory === category.id}
              onClick={() => onCategoryChange(category.id)}
            >
              <span>{category.mark}</span>
              <strong>{category.shortLabel}</strong>
              <small>{count}</small>
            </button>
          )
        })}
      </nav>

      <section className="asset-library-toolbar">
        <label className="asset-library-search">
          <SearchIcon size={14} />
          <input
            aria-label={`搜索${currentCategory.label}`}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={`搜索${currentCategory.label}`}
          />
        </label>
        <button className="asset-library-upload" onClick={() => uploadRef.current?.click()}>
          <PlusIcon size={14} />
          添加
        </button>
      </section>

      <section className="asset-library-section-head">
        <div>
          <strong>{currentCategory.label}</strong>
          <small>{currentCategory.description}</small>
        </div>
        <span>{visibleAssets.length} 项</span>
      </section>

      <section className="asset-library-grid">
        <button className={`asset-library-create-card ${visibleAssets.length === 0 ? 'empty' : ''}`} onClick={() => uploadRef.current?.click()}>
          <span><PlusIcon size={18} /></span>
          <strong>添加{currentCategory.shortLabel}素材</strong>
          <small>支持 JPG、PNG、WebP</small>
        </button>

        {visibleAssets.map((asset) => (
          <article className="asset-library-card" key={asset.id}>
            <div className="asset-library-image">
              <img src={asset.previewUrl} alt={asset.name} loading="lazy" />
              <span>{asset.source === 'generated' ? 'AI' : asset.source === 'canvas' ? '画布' : '上传'}</span>
            </div>
            <div className="asset-library-card-copy">
              <strong title={asset.name}>{asset.name}</strong>
              <small>{new Date(asset.createdAt).toLocaleDateString('zh-CN')}</small>
            </div>
            <div className="asset-library-card-actions">
              <button onClick={() => onUseAsset(asset)}>设为参考</button>
              <button onClick={() => onInsertAsset(asset)}>插入</button>
              <button className="danger" onClick={() => onDeleteAsset(asset)} title="删除资产" aria-label={`删除${asset.name}`}>
                <TrashIcon size={12} />
              </button>
            </div>
          </article>
        ))}
      </section>

      {visibleAssets.length === 0 && search && (
        <div className="asset-library-no-result">
          <strong>没有找到“{search}”相关素材</strong>
          <span>可以尝试更短的关键词，或切换其他资产分类。</span>
          <button onClick={() => onSearchChange('')}>清空搜索</button>
        </div>
      )}
    </main>
  )
}

interface AssetCategoryDialogProps {
  candidate: AssetCandidate
  onCancel: () => void
  onConfirm: (category: AssetCategory) => void
}

export const AssetCategoryDialog: React.FC<AssetCategoryDialogProps> = ({ candidate, onCancel, onConfirm }) => {
  const [category, setCategory] = React.useState<AssetCategory>(candidate.suggestedCategory)
  const dialogRef = useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ))
      if (focusable.length === 0) return
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
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onCancel])

  return (
    <div className="asset-picker-overlay" onClick={onCancel}>
      <section
        ref={dialogRef}
        className="asset-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-picker-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <strong id="asset-picker-title">加入资产库</strong>
            <small>选择图片要保存到的位置</small>
          </div>
          <button onClick={onCancel} aria-label="关闭">×</button>
        </header>
        <div className="asset-picker-preview">
          <img src={candidate.previewUrl} alt={candidate.name} />
          <span>{candidate.name}</span>
        </div>
        <div className="asset-picker-options">
          {categories.map((item) => (
            <button
              key={item.id}
              className={category === item.id ? 'active' : ''}
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              <span>{item.mark}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <i>{category === item.id ? '✓' : ''}</i>
            </button>
          ))}
        </div>
        <footer>
          <button onClick={onCancel}>取消</button>
          <button className="primary" onClick={() => onConfirm(category)}>确认加入</button>
        </footer>
      </section>
    </div>
  )
}
