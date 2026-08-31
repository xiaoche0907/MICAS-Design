import React, { useEffect, useState } from 'react'
import { ApiProfile } from '@messages/sender'
import { generationEngine } from '../engine/generationEngine'
import { DEFAULT_SELECTION_SHORTCUT, formatShortcut, shortcutFromKeyboardEvent } from '../utils/shortcut'
import {
  ImageHostProvider,
  getImageHostCredentialLabel,
  getImageHostDisplayName,
  testImageHostConnection,
} from '../utils/imgbb'
import {
  DEFAULT_MODEL_ID,
  PRESET_MODELS,
  matchProviderModels,
} from '../engine/modelRegistry'
import {
  SettingsIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  AlertIcon,
  SparklesIcon,
} from './icons'

const DEFAULT_VIRSE_BASE_URL = 'https://api.virse.ai'
const DEFAULT_VIRSE_RELAY_URL = 'https://www.cxworking.xyz/api/virse'
const DEFAULT_PLATO_BASE_URL = 'https://api.bltcy.ai'

type SettingsSection = 'models' | 'agents' | 'image-host' | 'shortcuts'

interface ApiSettingsModalProps {
  isOpen: boolean
  initialProfile: ApiProfile | null
  initialSection?: SettingsSection
  selectionShortcut: string
  onSelectionShortcutChange: (shortcut: string) => void
  onClose: () => void
  onSave: (profile: ApiProfile) => void
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  initialProfile,
  initialSection = 'models',
  selectionShortcut,
  onSelectionShortcutChange,
  onClose,
  onSave,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('models')
  const [provider, setProvider] = useState<ApiProfile['provider']>('apilio')
  const [baseUrl, setBaseUrl] = useState(DEFAULT_PLATO_BASE_URL)
  const [virseRelayUrl, setVirseRelayUrl] = useState(DEFAULT_VIRSE_RELAY_URL)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [agentBaseUrl, setAgentBaseUrl] = useState(DEFAULT_PLATO_BASE_URL)
  const [agentApiKey, setAgentApiKey] = useState('')
  const [showAgentKey, setShowAgentKey] = useState(false)
  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_MODEL_ID)
  const [modelIdMap, setModelIdMap] = useState<Record<string, string>>({})
  const [imageHostProvider, setImageHostProvider] = useState<ImageHostProvider>('imgbb')
  const [imgbbApiKey, setImgbbApiKey] = useState('')
  const [uploadcarePublicKey, setUploadcarePublicKey] = useState('')
  const [freeimageApiKey, setFreeimageApiKey] = useState('')
  const [showImgBbKey, setShowImgBbKey] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspacesList, setWorkspacesList] = useState<Array<{ id: string; name: string }>>([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testingImgBb, setTestingImgBb] = useState(false)
  const [imgbbTestResult, setImgBbTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [shortcutDraft, setShortcutDraft] = useState(selectionShortcut)

  useEffect(() => {
    if (!isOpen) return
    setActiveSection(initialSection)
    setShowKey(false)
    setShowAgentKey(false)
    setShowImgBbKey(false)
    setTestResult(null)
    setImgBbTestResult(null)
    setShortcutDraft(selectionShortcut)

    if (!initialProfile) {
      setProvider('apilio')
      setBaseUrl(DEFAULT_PLATO_BASE_URL)
      setVirseRelayUrl(DEFAULT_VIRSE_RELAY_URL)
      setApiKey('')
      setAgentBaseUrl(DEFAULT_PLATO_BASE_URL)
      setAgentApiKey('')
      setDefaultModelId(DEFAULT_MODEL_ID)
      setModelIdMap({})
      setImageHostProvider('imgbb')
      setImgbbApiKey('')
      setUploadcarePublicKey('')
      setFreeimageApiKey('')
      setWorkspaceId('')
      setWorkspacesList([])
      return
    }

    const nextProvider = initialProfile.provider || 'apilio'
    let nextBaseUrl = initialProfile.baseUrl
    if (nextProvider === 'apilio' && (!nextBaseUrl || /api\.apilio\.ai/i.test(nextBaseUrl))) {
      nextBaseUrl = DEFAULT_PLATO_BASE_URL
    } else if (!nextBaseUrl || /api\.virse\.ai\/mcp/i.test(nextBaseUrl)) {
      nextBaseUrl = nextProvider === 'virse' ? DEFAULT_VIRSE_BASE_URL : DEFAULT_PLATO_BASE_URL
    }

    setProvider(nextProvider)
    setBaseUrl(nextBaseUrl)
    const savedVirseRelayUrl = initialProfile.virseRelayUrl || ''
    setVirseRelayUrl(
      /(?:xcwork-tool\.online|1-sepia-gamma\.vercel\.app)\/api\/virse\/?$/i.test(savedVirseRelayUrl)
        ? DEFAULT_VIRSE_RELAY_URL
        : savedVirseRelayUrl || DEFAULT_VIRSE_RELAY_URL
    )
    setApiKey(initialProfile.apiKey || '')
    setAgentBaseUrl(
      initialProfile.agentBaseUrl
      || (nextProvider === 'apilio' ? nextBaseUrl : DEFAULT_PLATO_BASE_URL)
    )
    setAgentApiKey(
      initialProfile.agentApiKey
      || (nextProvider === 'apilio' ? initialProfile.apiKey || '' : '')
    )
    setDefaultModelId(initialProfile.defaultModelId || DEFAULT_MODEL_ID)
    setModelIdMap(initialProfile.modelIdMap || {})
    setImageHostProvider(
      initialProfile.imageHostProvider === 'uploadcare' || initialProfile.imageHostProvider === 'freeimage'
        ? initialProfile.imageHostProvider
        : 'imgbb'
    )
    setImgbbApiKey(initialProfile.imgbbApiKey || '')
    setUploadcarePublicKey(initialProfile.uploadcarePublicKey || '')
    setFreeimageApiKey(initialProfile.freeimageApiKey || '')
    setWorkspaceId(initialProfile.workspaceId || '')
    setWorkspacesList([])
  }, [initialProfile, initialSection, isOpen, selectionShortcut])

  if (!isOpen) return null

  const makeProfile = (): ApiProfile => ({
    id: 'current-profile',
    name: provider,
    provider,
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim(),
    defaultModelId,
    imageHostProvider,
    imgbbApiKey: imgbbApiKey.trim(),
    uploadcarePublicKey: uploadcarePublicKey.trim(),
    freeimageApiKey: freeimageApiKey.trim(),
    workspaceId,
    virseRelayUrl: provider === 'virse' ? virseRelayUrl.trim() : undefined,
    modelIdMap: provider === 'virse' ? modelIdMap : undefined,
    agentBaseUrl: agentBaseUrl.trim() || DEFAULT_PLATO_BASE_URL,
    agentApiKey: agentApiKey.trim(),
  })

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProvider = event.target.value as ApiProfile['provider']
    setProvider(nextProvider)
    setTestResult(null)
    setWorkspacesList([])
    setWorkspaceId('')
    setModelIdMap({})
    setDefaultModelId(DEFAULT_MODEL_ID)
    if (nextProvider === 'apilio') setBaseUrl(DEFAULT_PLATO_BASE_URL)
    if (nextProvider === 'virse') {
      setBaseUrl(DEFAULT_VIRSE_BASE_URL)
      setVirseRelayUrl(virseRelayUrl || DEFAULT_VIRSE_RELAY_URL)
    }
    if (nextProvider === 'openai-compatible') setBaseUrl('https://api.openai.com')
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await generationEngine.testConnection(makeProfile())
      setTestResult(result)
      if (result.baseUrl) setBaseUrl(result.baseUrl)

      const nextWorkspaces = result.workspaces || []
      setWorkspacesList(nextWorkspaces)
      if (nextWorkspaces.length > 0) {
        if (!workspaceId || !nextWorkspaces.some((workspace) => workspace.id === workspaceId)) {
          setWorkspaceId(nextWorkspaces[0].id)
        }
      } else if (provider === 'virse') {
        setWorkspaceId('')
      }

      if (provider === 'virse' && result.models) {
        setModelIdMap(matchProviderModels(result.models))
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error?.message || String(error) })
    } finally {
      setTesting(false)
    }
  }

  const handleTestImgBbConnection = async () => {
    setTestingImgBb(true)
    setImgBbTestResult(null)
    try {
      const currentApiKey = imageHostProvider === 'uploadcare'
        ? uploadcarePublicKey
        : imageHostProvider === 'freeimage'
          ? freeimageApiKey
          : imgbbApiKey
      await testImageHostConnection(imageHostProvider, currentApiKey)
      setImgBbTestResult({
        success: true,
        message: imageHostProvider === 'imgbb'
          ? 'ImgBB 连接成功，测试图片将在 60 秒后自动删除。'
          : imageHostProvider === 'freeimage'
            ? 'Freeimage.host 连接成功。'
            : 'Uploadcare 连接成功，测试图片将按临时文件处理。',
      })
    } catch (error: any) {
      const message = error?.message || String(error)
      if (
        imageHostProvider === 'imgbb'
        && /(?:\b103\b|forbidden|been forbidden)/i.test(message)
        && freeimageApiKey.trim()
      ) {
        try {
          await testImageHostConnection('freeimage', freeimageApiKey)
          setImageHostProvider('freeimage')
          setImgBbTestResult({
            success: true,
            message: 'ImgBB 禁止了当前账号或请求出口（103）。已自动切换到可用的 Freeimage.host，请点击“保存配置”。',
          })
          return
        } catch (_) {
          // Preserve the original ImgBB error when the fallback cannot connect.
        }
      }
      const hint = /failed to fetch|networkerror/i.test(message)
        ? `无法通过 CX Working 连接 ${getImageHostDisplayName(imageHostProvider)}，请检查 cxworking.xyz 的部署和网络。`
        : message
      setImgBbTestResult({ success: false, message: hint })
    } finally {
      setTestingImgBb(false)
    }
  }

  const renderPasswordInput = (
    value: string,
    onChange: (value: string) => void,
    visible: boolean,
    onToggle: () => void,
    placeholder: string
  ) => (
    <div className="v2-password-wrapper">
      <input
        type={visible ? 'text' : 'password'}
        className="v2-form-input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="v2-eye-toggle-btn"
        title={visible ? '隐藏密钥' : '显示密钥'}
        onClick={onToggle}
      >
        {visible
          ? <EyeOffIcon size={15} color="#9CA3AF" />
          : <EyeIcon size={15} color="#9CA3AF" />}
      </button>
    </div>
  )

  return (
    <div className="v2-modal-overlay" onClick={onClose}>
      <div className="v2-modal-card v2-settings-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="v2-modal-top-bar" />

        <div className="v2-modal-header">
          <div className="v2-modal-title-group">
            <div className="v2-modal-icon-badge">
              <SettingsIcon size={15} color="#FFFFFF" />
            </div>
            <span className="v2-modal-title">全局设置</span>
          </div>
          <button className="v2-modal-close" title="关闭设置" onClick={onClose}>
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="v2-settings-tabs" role="tablist" aria-label="设置分类">
          <button
            className={`v2-settings-tab ${activeSection === 'models' ? 'active' : ''}`}
            onClick={() => setActiveSection('models')}
          >
            <span>◈</span><span>模型服务</span>
          </button>
          <button
            className={`v2-settings-tab ${activeSection === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveSection('agents')}
          >
            <span>✦</span><span>智能体</span>
          </button>
          <button
            className={`v2-settings-tab ${activeSection === 'image-host' ? 'active' : ''}`}
            onClick={() => setActiveSection('image-host')}
          >
            <span>▧</span><span>图床服务</span>
          </button>
          <button
            className={`v2-settings-tab ${activeSection === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveSection('shortcuts')}
          >
            <span>⌨</span><span>快捷键</span>
          </button>
        </div>

        <div className="v2-modal-body v2-settings-body">
          {activeSection === 'models' && (
            <div className="v2-settings-pane">
              <div className="v2-pane-heading">
                <strong>模型服务配置</strong>
                <span>选择模型服务并填写 API Key</span>
              </div>

              <div className="v2-form-group">
                <label className="v2-form-label">服务提供商 (Provider)</label>
                <select className="v2-form-select" value={provider} onChange={handleProviderChange}>
                  <option value="apilio">柏拉图 API 中转 (推荐)</option>
                  <option value="virse">Virse 创意平台 (MCP)</option>
                </select>
              </div>

              <div className="v2-form-group">
                <label className="v2-form-label">API Key (Token)</label>
                {renderPasswordInput(apiKey, setApiKey, showKey, () => setShowKey(!showKey), '填写 API Key')}
                <span className="v2-form-tip">Key 仅保存在 MasterGo clientStorage，服务地址由插件自动配置。</span>
              </div>

              {provider === 'virse' && (
                <div className="v2-form-group">
                  <label className="v2-form-label">目标工作区 / 画布</label>
                  <select
                    className="v2-form-select"
                    value={workspaceId}
                    onChange={(event) => setWorkspaceId(event.target.value)}
                  >
                    <option value="">请测试并同步工作区</option>
                    {workspacesList.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>{workspace.name || workspace.id}</option>
                    ))}
                  </select>
                  <span className="v2-form-tip">
                    {workspacesList.length > 0
                      ? `已同步 ${workspacesList.length} 个真实工作区/画布，生成时会同时使用 space_id 与 canvas_id。`
                      : '测试时会依次检查 API 与 Dev 节点，并兼容 Virse 文本/JSON 两种工作区格式。'}
                  </span>
                </div>
              )}

              {testResult && (
                <div className={`v2-test-box ${testResult.success ? 'success' : 'error'}`}>
                  <span className="v2-test-status-icon">
                    {testResult.success
                      ? <CheckIcon size={15} color="#34D399" />
                      : <AlertIcon size={15} color="#F87171" />}
                  </span>
                  <span className="v2-test-status-text">{testResult.message}</span>
                </div>
              )}

              <button className="v2-test-btn" disabled={testing} onClick={handleTestConnection}>
                {testing ? (
                  <><div className="v2-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} /><span>正在测试并同步...</span></>
                ) : (
                  <><SparklesIcon size={14} color="#FFFFFF" /><span>测试并同步</span></>
                )}
              </button>
            </div>
          )}

          {activeSection === 'agents' && (
            <div className="v2-settings-pane">
              <div className="v2-pane-heading">
                <strong>智能体设置</strong>
                <span>填写提示词 AI 润色服务的 API Key</span>
              </div>

              <div className="v2-form-group">
                <label className="v2-form-label">柏拉图智能体 API Key</label>
                {renderPasswordInput(
                  agentApiKey,
                  setAgentApiKey,
                  showAgentKey,
                  () => setShowAgentKey(!showAgentKey),
                  '填写柏拉图 API Key'
                )}
                <span className="v2-form-tip">
                  三个模型逐次轮询；当前模型报错时不等待，立即切换到下一个模型。
                </span>
              </div>

              <div className="v2-form-group">
                <label className="v2-form-label">智能体默认图片模型</label>
                <select
                  className="v2-form-select"
                  value={defaultModelId}
                  onChange={(event) => setDefaultModelId(event.target.value)}
                >
                  {PRESET_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>{model.displayName}</option>
                  ))}
                </select>
                <span className="v2-form-tip">默认使用 Nanobanana 2；主界面的临时模型选择仍会优先。</span>
              </div>

              <div className="v2-agent-route-card">
                <div className="v2-agent-route-title">
                  <span className="v2-status-dot" />
                  <strong>{provider === 'virse' ? 'Virse 自动模型路由' : '柏拉图固定模型路由'}</strong>
                </div>
                <div className="v2-model-map-list">
                  {PRESET_MODELS.map((model) => (
                    <div className="v2-model-map-row" key={model.id}>
                      <span>{model.displayName}</span>
                      <code>{provider === 'virse' ? modelIdMap[model.id] || '待测试同步' : model.modelId}</code>
                    </div>
                  ))}
                </div>
              </div>

              {provider === 'virse' && Object.keys(modelIdMap).length === 0 && (
                <div className="v2-inline-notice">请前往“模型服务”执行测试并同步，插件会调用 list_image_models 自动建立映射。</div>
              )}
            </div>
          )}

          {activeSection === 'image-host' && (
            <div className="v2-settings-pane">
              <div className="v2-pane-heading">
                <strong>图床服务</strong>
                <span>本地参考图的公网托管与 Virse 画布导入配置</span>
              </div>

              <div className="v2-image-host-options" role="radiogroup" aria-label="选择图床服务">
                <button
                  type="button"
                  role="radio"
                  aria-checked={imageHostProvider === 'imgbb'}
                  className={`v2-image-host-card ${imageHostProvider === 'imgbb' ? 'active' : ''}`}
                  onClick={() => {
                    setImageHostProvider('imgbb')
                    setShowImgBbKey(false)
                    setImgBbTestResult(null)
                  }}
                >
                  <div className="v2-image-host-badge">ImgBB</div>
                  <div>
                    <strong>ImgBB 图床（默认）</strong>
                    <span>通过 CX Working HTTPS 中转上传</span>
                  </div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={imageHostProvider === 'uploadcare'}
                  className={`v2-image-host-card ${imageHostProvider === 'uploadcare' ? 'active' : ''}`}
                  onClick={() => {
                    setImageHostProvider('uploadcare')
                    setShowImgBbKey(false)
                    setImgBbTestResult(null)
                  }}
                >
                  <div className="v2-image-host-badge uploadcare">UC</div>
                  <div>
                    <strong>Uploadcare</strong>
                    <span>可直连 MasterGo，无需中转</span>
                  </div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={imageHostProvider === 'freeimage'}
                  className={`v2-image-host-card ${imageHostProvider === 'freeimage' ? 'active' : ''}`}
                  onClick={() => {
                    setImageHostProvider('freeimage')
                    setShowImgBbKey(false)
                    setImgBbTestResult(null)
                  }}
                >
                  <div className="v2-image-host-badge freeimage">Free</div>
                  <div>
                    <strong>Freeimage.host</strong>
                    <span>通过 CX Working HTTPS 中转上传</span>
                  </div>
                </button>
              </div>

              <div className="v2-form-group">
                <label className="v2-form-label">
                  {getImageHostDisplayName(imageHostProvider)} {getImageHostCredentialLabel(imageHostProvider)}
                </label>
                {renderPasswordInput(
                  imageHostProvider === 'uploadcare'
                    ? uploadcarePublicKey
                    : imageHostProvider === 'freeimage'
                      ? freeimageApiKey
                      : imgbbApiKey,
                  (value) => {
                    if (imageHostProvider === 'uploadcare') setUploadcarePublicKey(value)
                    else if (imageHostProvider === 'freeimage') setFreeimageApiKey(value)
                    else setImgbbApiKey(value)
                    setImgBbTestResult(null)
                  },
                  showImgBbKey,
                  () => setShowImgBbKey(!showImgBbKey),
                  '使用本地参考图时填写'
                )}
                <span className="v2-form-tip">
                  {imageHostProvider === 'uploadcare'
                    ? 'Uploadcare 使用 Public Key 从插件 UI 直传，不需要 Secret Key 或中转服务。'
                    : imageHostProvider === 'freeimage'
                      ? 'Freeimage.host 仅通过 CX Working HTTPS 中转上传。'
                      : 'ImgBB 优先通过 CX Working HTTPS 中转；若上游返回 103，已配置 Freeimage.host 时会自动回退。'}
                </span>
                <a
                  className="v2-key-link"
                  href={imageHostProvider === 'uploadcare'
                    ? 'https://app.uploadcare.com/'
                    : imageHostProvider === 'freeimage'
                      ? 'https://freeimage.host/api'
                      : 'https://api.imgbb.com/'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  获取 {getImageHostDisplayName(imageHostProvider)} {getImageHostCredentialLabel(imageHostProvider)} <span aria-hidden="true">↗</span>
                </a>
              </div>

              {imgbbTestResult && (
                <div className={`v2-test-box ${imgbbTestResult.success ? 'success' : 'error'}`}>
                  <span className="v2-test-status-icon">
                    {imgbbTestResult.success
                      ? <CheckIcon size={15} color="#34D399" />
                      : <AlertIcon size={15} color="#F87171" />}
                  </span>
                  <span className="v2-test-status-text">{imgbbTestResult.message}</span>
                </div>
              )}

              <button
                type="button"
                className="v2-test-btn"
                disabled={testingImgBb}
                onClick={handleTestImgBbConnection}
              >
                {testingImgBb ? (
                  <><div className="v2-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} /><span>正在测试图床连接...</span></>
                ) : (
                  <><SparklesIcon size={14} color="#FFFFFF" /><span>测试 {getImageHostDisplayName(imageHostProvider)} 连接</span></>
                )}
              </button>

              <div className="v2-inline-notice">纯文字生图不需要图床；只有本地参考图或 MasterGo 图层参与生成时才需要。</div>
            </div>
          )}

          {activeSection === 'shortcuts' && (
            <div className="v2-settings-pane">
              <div className="v2-pane-heading">
                <strong>快捷键设置</strong>
                <span>自定义将画布当前选中图层批量加入参考图的快捷键</span>
              </div>

              <div className="v2-form-group">
                <label className="v2-form-label">批量加入画布选中图片</label>
                <div className="v2-shortcut-row">
                  <input
                    className="v2-form-input v2-shortcut-recorder"
                    readOnly
                    value={formatShortcut(shortcutDraft)}
                    aria-label="录制批量加入快捷键"
                    title="点击后按下新的组合键"
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      event.preventDefault()
                      const nextShortcut = shortcutFromKeyboardEvent(event)
                      if (nextShortcut) setShortcutDraft(nextShortcut)
                    }}
                  />
                  <button
                    type="button"
                    className="v2-shortcut-reset"
                    onClick={() => setShortcutDraft(DEFAULT_SELECTION_SHORTCUT)}
                  >
                    恢复默认
                  </button>
                </div>
                <span className="v2-form-tip">
                  点击输入框并按下新的组合键。默认：Ctrl/⌘ + Shift + V。快捷键在插件窗口获得焦点时生效。
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="v2-modal-footer">
          <button className="v2-btn-cancel" onClick={onClose}>取消</button>
          <button className="v2-btn-save" onClick={() => {
            onSelectionShortcutChange(shortcutDraft)
            onSave(makeProfile())
          }}>保存配置</button>
        </div>
      </div>
    </div>
  )
}
