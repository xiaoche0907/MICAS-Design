import React, { useState } from 'react'
import { GeneratedImage } from '../engine/types'

interface ResultViewerProps {
  results: GeneratedImage[]
  onInsertToCanvas: (image: GeneratedImage) => void
  onReuseAsReference: (image: GeneratedImage) => void
  onAddToAssets: (image: GeneratedImage) => void
  onDelete: (image: GeneratedImage) => void
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  results,
  onInsertToCanvas,
  onReuseAsReference,
  onAddToAssets,
  onDelete,
}) => {
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null)

  const downloadImage = (image: GeneratedImage) => {
    const temporaryUrl = image.bytes?.length
      ? URL.createObjectURL(new Blob([image.bytes as any], { type: image.mimeType || 'image/png' }))
      : null
    const link = document.createElement('a')
    link.href = temporaryUrl || image.url
    link.download = `${image.transient ? 'MICAS-快速抠图' : 'MICAS-image'}.png`
    link.click()
    if (temporaryUrl) window.setTimeout(() => URL.revokeObjectURL(temporaryUrl), 1000)
  }

  if (!results?.length) return null

  return (
    <div className="history-result-grid">
      {results.map((image) => (
        <article key={image.id} className="history-result-card">
          <button
            className="history-result-delete"
            onClick={() => onDelete(image)}
            title="删除这条记录"
            aria-label="删除这条生成记录"
          >
            ×
          </button>
          <button
            className="history-result-preview"
            onClick={() => setPreviewImage(image)}
            title="查看大图"
          >
            <img src={image.url} alt="AI 生成记录" />
            <span>查看大图</span>
          </button>
          <div className="history-result-meta">
            <span>{new Date(image.createdAt).toLocaleString('zh-CN')}</span>
            {image.width && image.height && <span>{image.width} × {image.height}</span>}
          </div>
          <div className="history-result-actions">
            <button onClick={() => downloadImage(image)}>下载 PNG</button>
            <button onClick={() => onReuseAsReference(image)}>设为参考</button>
            <button onClick={() => onAddToAssets(image)}>加入资产</button>
            <button className="primary" onClick={() => onInsertToCanvas(image)}>插入画布</button>
          </div>
        </article>
      ))}

      {previewImage && (
        <div className="history-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="history-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="history-preview-head">
              <strong>图片预览</strong>
              <button onClick={() => setPreviewImage(null)}>×</button>
            </div>
            <div className="history-preview-body">
              <img src={previewImage.url} alt="AI 生成图大图预览" />
            </div>
          <div className="history-preview-actions">
            <button onClick={() => downloadImage(previewImage)}>下载 PNG</button>
              <button
                className="danger"
                onClick={() => {
                  onDelete(previewImage)
                  setPreviewImage(null)
                }}
              >
                删除记录
              </button>
              <button onClick={() => onReuseAsReference(previewImage)}>设为参考图</button>
              <button onClick={() => onAddToAssets(previewImage)}>加入资产库</button>
              <button
                className="primary"
                onClick={() => {
                  onInsertToCanvas(previewImage)
                  setPreviewImage(null)
                }}
              >
                插入 MasterGo 画布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
