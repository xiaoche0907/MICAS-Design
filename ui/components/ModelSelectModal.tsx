import React, { useState, useMemo } from 'react'
import { ExtendedModelDefinition } from '../engine/modelRegistry'
import { CloseIcon, SearchIcon, SparklesIcon } from './icons'

interface ModelSelectModalProps {
  isOpen: boolean
  models: ExtendedModelDefinition[]
  selectedModelId: string
  onSelectModel: (model: ExtendedModelDefinition) => void
  onClose: () => void
}

export const getModelIcon = (iconType: ExtendedModelDefinition['iconType']) => {
  switch (iconType) {
    case 'openai':
      return <span className="model-brand-badge openai" title="OpenAI">🌐</span>
    case 'google':
      return <span className="model-brand-badge google" title="Google">●</span>
    case 'seedream':
      return <span className="model-brand-badge seedream" title="ByteDance Seedream">◆</span>
    case 'virse':
      return <span className="model-brand-badge virse" title="Black Forest Labs (FLUX)">⚡</span>
    default:
      return <span className="model-brand-badge custom" title="Custom Model">⚙</span>
  }
}

type ProviderFilter = 'all' | 'google' | 'openai' | 'flux' | 'seedream' | 'other'

export const ModelSelectModal: React.FC<ModelSelectModalProps> = ({
  isOpen,
  models,
  selectedModelId,
  onSelectModel,
  onClose,
}) => {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ProviderFilter>('all')

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const text = `${model.displayName} ${model.id} ${model.modelId}`.toLowerCase()
      const matchesSearch = !search.trim() || text.includes(search.trim().toLowerCase())

      if (!matchesSearch) return false

      if (activeFilter === 'all') return true
      if (activeFilter === 'google') return model.iconType === 'google' || text.includes('google') || text.includes('banana')
      if (activeFilter === 'openai') return model.iconType === 'openai' || text.includes('openai') || text.includes('gpt')
      if (activeFilter === 'flux') return model.iconType === 'virse' || text.includes('flux') || text.includes('bfl')
      if (activeFilter === 'seedream') return model.iconType === 'seedream' || text.includes('seedream') || text.includes('bytedance')
      if (activeFilter === 'other') return model.iconType === 'custom' || text.includes('ideogram') || text.includes('tongyi')

      return true
    })
  }, [models, search, activeFilter])

  if (!isOpen) return null

  return (
    <div className="v2-modal-overlay" onClick={onClose}>
      <div
        className="v2-modal-card v2-model-select-modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-select-modal-title"
      >
        <div className="v2-modal-top-bar" />

        <div className="v2-modal-header">
          <div className="v2-modal-title-group">
            <div className="v2-modal-icon-badge">
              <SparklesIcon size={15} color="#FFFFFF" />
            </div>
            <div>
              <span id="model-select-modal-title" className="v2-modal-title">选择 AI 图像模型</span>
              <small className="v2-modal-subtitle">已接入 {models.length} 款模型 · 包含 Google、OpenAI、FLUX、Seedream</small>
            </div>
          </div>
          <button className="v2-modal-close" title="关闭" onClick={onClose}>
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="v2-model-modal-toolbar">
          <div className="v2-model-modal-search">
            <SearchIcon size={14} color="#777777" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模型名称，如 Flux、Gemini、GPT-Image..."
              autoFocus
            />
            {search && (
              <button className="v2-search-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>

          <div className="v2-model-modal-filters">
            {[
              { id: 'all', label: '全部' },
              { id: 'google', label: 'Google / Nano' },
              { id: 'openai', label: 'OpenAI' },
              { id: 'flux', label: 'FLUX / BFL' },
              { id: 'seedream', label: 'Seedream' },
              { id: 'other', label: '其他' },
            ].map((f) => (
              <button
                key={f.id}
                className={`v2-model-filter-chip ${activeFilter === f.id ? 'active' : ''}`}
                onClick={() => setActiveFilter(f.id as ProviderFilter)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="v2-model-modal-list">
          {filteredModels.length === 0 ? (
            <div className="v2-model-modal-empty">
              <span>未找到与 “{search}” 匹配的模型</span>
              <button onClick={() => { setSearch(''); setActiveFilter('all') }}>重置筛选</button>
            </div>
          ) : (
            filteredModels.map((m) => {
              const isSelected = selectedModelId === m.id
              const isDefault = m.id === 'nanobanana-2'
              const maxRes = m.supportedResolutions?.[m.supportedResolutions.length - 1] || '4K'
              const ratioCount = m.supportedRatios?.length || 7

              return (
                <div
                  key={m.id}
                  className={`v2-model-card-item ${isSelected ? 'selected' : ''} ${isDefault ? 'is-default' : ''}`}
                  onClick={() => {
                    onSelectModel(m)
                    onClose()
                  }}
                >
                  <div className="v2-model-card-icon">
                    {getModelIcon(m.iconType)}
                  </div>
                  <div className="v2-model-card-info">
                    <div className="v2-model-card-title-row">
                      <strong className="v2-model-card-name">{m.displayName}</strong>
                      {isDefault && <span className="v2-model-badge default">默认推荐</span>}
                      {isSelected && <span className="v2-model-badge active">使用中</span>}
                    </div>
                    <div className="v2-model-card-specs">
                      <span>最高 {maxRes}</span>
                      <span>•</span>
                      <span>{ratioCount} 种比例</span>
                      {m.supportedRatios?.includes('Original') && (
                        <>
                          <span>•</span>
                          <span>支持原图自适应</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="v2-model-card-radio">
                    <span className={`v2-radio-dot ${isSelected ? 'checked' : ''}`} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
