import React, { useRef } from 'react'
import { ReferenceImage, ReferenceRole } from '../engine/types'
import { CloseIcon, PlusIcon, UploadCloudIcon } from './icons'

interface ReferenceGalleryProps {
  references: ReferenceImage[]
  onAddUpload: (file: File) => void
  onAddFromMasterGo: () => void
  onRemove: (id: string) => void
  onRoleChange: (id: string, role: ReferenceRole) => void
}

const ROLE_OPTIONS: { value: ReferenceRole; label: string }[] = [
  { value: 'product', label: '产品 (Product)' },
  { value: 'model', label: '模特 (Model)' },
  { value: 'scene', label: '场景 (Scene)' },
  { value: 'pose', label: '姿势 (Pose)' },
  { value: 'style', label: '风格 (Style)' },
  { value: 'hair', label: '发型 (Hair)' },
  { value: 'makeup', label: '妆容 (Makeup)' },
  { value: 'composition', label: '构图 (Composition)' },
  { value: 'color', label: '色调 (Color)' },
  { value: 'other', label: '其他 (Other)' },
]

export const ReferenceGallery: React.FC<ReferenceGalleryProps> = ({
  references,
  onAddUpload,
  onAddFromMasterGo,
  onRemove,
  onRoleChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onAddUpload(files[0])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="section-panel">
      <div className="section-header">
        <span className="section-title">参考图库 (REFERENCES)</span>
        <span className="selection-count-badge">{references.length} 张图片</span>
      </div>

      {/* 隐蔽式本地文件选择器 */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* 操作按钮组 */}
      <div className="ref-actions-bar">
        <button
          className="btn-secondary flex-1"
          onClick={() => fileInputRef.current?.click()}
        >
          <PlusIcon size={14} /> 本地上传
        </button>
        <button className="btn-secondary flex-1" onClick={onAddFromMasterGo}>
          <UploadCloudIcon size={14} /> 来自 MasterGo 选区
        </button>
      </div>

      {/* 参考图网格列举 */}
      {references.length > 0 ? (
        <div className="ref-grid">
          {references.map((ref, idx) => (
            <div key={ref.id} className="ref-card">
              <div className="ref-thumbnail-wrapper" style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    background: 'rgba(0, 0, 0, 0.88)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    zIndex: 5,
                  }}
                >
                  图 {idx + 1}
                </span>
                <img
                  src={ref.previewUrl}
                  alt={ref.name || `图 ${idx + 1}`}
                  className="ref-thumbnail"
                />
                <button
                  className="ref-delete-btn"
                  title="删除此参考图"
                  onClick={() => onRemove(ref.id)}
                >
                  <CloseIcon size={12} />
                </button>
              </div>

              {/* 角色 Role 下拉框 */}
              <div className="ref-role-selector-wrapper">
                <select
                  className="ref-role-select"
                  value={ref.role}
                  onChange={(e) =>
                    onRoleChange(ref.id, e.target.value as ReferenceRole)
                  }
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          尚未添加参考图。上传图片或直接使用 MasterGo 选区图层作为 AI 参考。
        </div>
      )}
    </div>
  )
}
