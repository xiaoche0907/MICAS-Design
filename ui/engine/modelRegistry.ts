import { ApiProfile } from '@messages/sender'
import { ModelDefinition } from './types'

export interface ExtendedModelDefinition extends ModelDefinition {
  iconType: 'openai' | 'google' | 'seedream' | 'virse' | 'custom'
}

export interface ProviderModel {
  id: string
  name?: string
  provider?: string
}

// Plato model ids are intentionally kept here as the single source of truth.
// Nano 2 is the product default even though GPT Image 2 remains first visually.
export const PRESET_MODELS: ExtendedModelDefinition[] = [
  {
    id: 'nanobanana-2',
    displayName: 'Nano Banana 2 · FAL.ai',
    provider: 'apilio',
    modelId: 'gemini-3.1-flash-image-preview',
    protocol: 'gemini',
    iconType: 'google',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'gpt-image-2',
    displayName: 'GPT-Image-2 · OpenAI',
    provider: 'apilio',
    modelId: 'gpt-image-2',
    protocol: 'openai-image',
    iconType: 'openai',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '4:5', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'gpt-image-1.5',
    displayName: 'GPT-Image-1.5 · OpenAI',
    provider: 'apilio',
    modelId: 'gpt-image-1.5',
    protocol: 'openai-image',
    iconType: 'openai',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '4:5', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'gpt-image-1',
    displayName: 'GPT-Image-1 · OpenAI',
    provider: 'apilio',
    modelId: 'gpt-image-1',
    protocol: 'openai-image',
    iconType: 'openai',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K'],
  },
  {
    id: 'nanobanana-pro',
    displayName: 'Nano Banana Pro · FAL.ai',
    provider: 'apilio',
    modelId: 'nano-banana-pro',
    protocol: 'gemini',
    iconType: 'google',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'nanobanana-lite',
    displayName: 'Nano Banana Lite · FAL.ai',
    provider: 'apilio',
    modelId: 'nano-banana-lite',
    protocol: 'gemini',
    iconType: 'google',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K'],
  },
  {
    id: 'flux-1.1-pro',
    displayName: 'FLUX 1.1 Pro · BFL.ai',
    provider: 'virse',
    modelId: 'flux-1.1-pro',
    protocol: 'openai-image',
    iconType: 'virse',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16', '21:9'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'flux-1.1-pro-ultra',
    displayName: 'FLUX 1.1 Pro Ultra · BFL.ai',
    provider: 'virse',
    modelId: 'flux-1.1-pro-ultra',
    protocol: 'openai-image',
    iconType: 'virse',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16', '21:9'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'flux-2-pro',
    displayName: 'FLUX 2 Pro · FAL.ai',
    provider: 'virse',
    modelId: 'flux-2-pro',
    protocol: 'openai-image',
    iconType: 'virse',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16', '21:9'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'flux-kontext-pro',
    displayName: 'FLUX Kontext Pro · BFL.ai',
    provider: 'virse',
    modelId: 'flux-kontext-pro',
    protocol: 'openai-image',
    iconType: 'virse',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'flux-kontext-max',
    displayName: 'FLUX Kontext Max · BFL.ai',
    provider: 'virse',
    modelId: 'flux-kontext-max',
    protocol: 'openai-image',
    iconType: 'virse',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'ideogram-4.0',
    displayName: 'Ideogram 4.0 · Ideogram',
    provider: 'virse',
    modelId: 'ideogram-4.0',
    protocol: 'openai-image',
    iconType: 'custom',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K'],
  },
  {
    id: 'z-image-turbo',
    displayName: 'Z-Image Turbo · FAL.ai (Tongyi-MAI)',
    provider: 'virse',
    modelId: 'z-image-turbo',
    protocol: 'openai-image',
    iconType: 'custom',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '4:5', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K'],
  },
  {
    id: 'seedream-4',
    displayName: 'Seedream 4 · FAL.ai (ByteDance)',
    provider: 'virse',
    modelId: 'seedream-4',
    protocol: 'openai-image',
    iconType: 'seedream',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K'],
  },
  {
    id: 'seedream-4.5',
    displayName: 'Seedream 4.5 · FAL.ai (ByteDance)',
    provider: 'virse',
    modelId: 'seedream-4.5',
    protocol: 'openai-image',
    iconType: 'seedream',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '4:5', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'seedream-5-lite',
    displayName: 'Seedream V5 Lite · FAL.ai (ByteDance)',
    provider: 'apilio',
    modelId: 'seedream-v5-pro',
    protocol: 'openai-image',
    iconType: 'seedream',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '4:5', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'gemini-2.5-flash-image',
    displayName: 'Gemini 2.5 Flash Image · Google',
    provider: 'virse',
    modelId: 'gemini-2.5-flash-image',
    protocol: 'gemini',
    iconType: 'google',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image Preview · Google',
    provider: 'virse',
    modelId: 'gemini-3-pro-image-preview',
    protocol: 'gemini',
    iconType: 'google',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
]

export const DEFAULT_MODEL_ID = 'nanobanana-2'

const normalizeModelText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const modelMatchers: Record<string, RegExp[]> = {
  'gpt-image-2': [
    /^gpt[-_.]?image[-_.]?2$/i,
    /gpt.*image.*2/i,
  ],
  'gpt-image-1.5': [
    /^gpt[-_.]?image[-_.]?1[.-]?5$/i,
    /gpt.*image.*1[.-]?5/i,
  ],
  'gpt-image-1': [
    /^gpt[-_.]?image[-_.]?1$/i,
    /gpt.*image.*1$/i,
  ],
  'nanobanana-2': [
    /^gemini[-_.]?3[.-]?1[-_.]?flash[-_.]?image[-_.]?preview$/i,
    /gemini.*3[.-]?1.*flash.*image/i,
    /nano.*banana.*(?:2|flash)/i,
  ],
  'nanobanana-pro': [
    /^nano[-_.]?banana[-_.]?pro$/i,
    /nano.*banana.*pro/i,
    /gemini.*pro.*image/i,
  ],
  'nanobanana-lite': [
    /^nano[-_.]?banana[-_.]?lite$/i,
    /nano.*banana.*lite/i,
  ],
  'flux-1.1-pro': [
    /^flux[-_.]?1[.-]?1[-_.]?pro$/i,
    /flux.*1[.-]?1.*pro/i,
  ],
  'flux-1.1-pro-ultra': [
    /^flux[-_.]?1[.-]?1[-_.]?pro[-_.]?ultra$/i,
    /flux.*1[.-]?1.*ultra/i,
  ],
  'flux-2-pro': [
    /^flux[-_.]?2[-_.]?pro$/i,
    /flux.*2.*pro/i,
  ],
  'flux-kontext-pro': [
    /^flux[-_.]?kontext[-_.]?pro$/i,
    /flux.*kontext.*pro/i,
  ],
  'flux-kontext-max': [
    /^flux[-_.]?kontext[-_.]?max$/i,
    /flux.*kontext.*max/i,
  ],
  'ideogram-4.0': [
    /^ideogram[-_.]?(?:4[.-]?0|v?2)?$/i,
    /ideogram/i,
  ],
  'z-image-turbo': [
    /^z[-_.]?image[-_.]?turbo$/i,
    /z.*image.*turbo/i,
  ],
  'seedream-4': [
    /^seedream[-_.]?4$/i,
    /seedream.*4$/i,
  ],
  'seedream-4.5': [
    /^seedream[-_.]?4[.-]?5$/i,
    /seedream.*4[.-]?5/i,
  ],
  'seedream-5-lite': [
    /^seedream[-_.]?v?5[-_.]?(?:pro|lite)?$/i,
    /seedream.*(?:v?5|5[.-]?0).*(?:pro|lite)?/i,
  ],
  'gemini-2.5-flash-image': [
    /^gemini[-_.]?2[.-]?5[-_.]?flash[-_.]?image$/i,
    /gemini.*2[.-]?5.*flash/i,
  ],
  'gemini-3-pro-image-preview': [
    /^gemini[-_.]?3[-_.]?pro[-_.]?image[-_.]?preview$/i,
    /gemini.*3.*pro.*image/i,
  ],
}

const matchesCanonicalModel = (canonicalId: string, model: ProviderModel): boolean => {
  const candidates = [model.id, model.name || ''].filter(Boolean)
  const exactTarget = PRESET_MODELS.find((preset) => preset.id === canonicalId)?.modelId || ''
  if (candidates.some((candidate) => normalizeModelText(candidate) === normalizeModelText(exactTarget))) return true
  return candidates.some((candidate) => (modelMatchers[canonicalId] || []).some((matcher) => matcher.test(candidate)))
}

/** Match provider-specific ids returned by Virse to preset UI models. */
export const matchProviderModels = (models: ProviderModel[]): Record<string, string> => {
  const result: Record<string, string> = {}
  const usedIds = new Set<string>()

  // First pass: match known preset models
  for (const preset of PRESET_MODELS) {
    const matched = models.find((model) => !usedIds.has(model.id) && matchesCanonicalModel(preset.id, model))
    if (matched) {
      result[preset.id] = matched.id
      usedIds.add(matched.id)
    }
  }

  // Second pass: map unmapped provider models directly by their id
  for (const model of models) {
    if (!usedIds.has(model.id)) {
      result[model.id] = model.id
      usedIds.add(model.id)
    }
  }

  return result
}

export const getModelsForProfile = (profile: ApiProfile | null): ExtendedModelDefinition[] => {
  if (profile?.provider !== 'virse') {
    return PRESET_MODELS
  }

  const map = profile.modelIdMap || {}
  const result: ExtendedModelDefinition[] = PRESET_MODELS.map((preset) => ({
    ...preset,
    provider: 'virse',
    modelId: map[preset.id] || preset.modelId || preset.id,
  }))

  // Add any custom Virse models that were discovered during connection test but not in PRESET_MODELS
  for (const [key, val] of Object.entries(map)) {
    if (!result.some((m) => m.id === key)) {
      const lower = key.toLowerCase()
      const iconType = lower.includes('gpt') || lower.includes('openai')
        ? 'openai'
        : lower.includes('google') || lower.includes('gemini') || lower.includes('banana')
          ? 'google'
          : lower.includes('seedream')
            ? 'seedream'
            : lower.includes('flux')
              ? 'virse'
              : 'custom'
      result.push({
        id: key,
        displayName: key,
        provider: 'virse',
        modelId: val,
        protocol: 'openai-image',
        iconType,
        capabilities: { textToImage: true, imageToImage: true, multiImage: true },
        maxReferences: 10,
        supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '4:3', '16:9', '9:16', '21:9'],
        supportedResolutions: ['1K', '2K', '4K'],
      })
    }
  }

  return result
}

export function getModelById(id: string): ExtendedModelDefinition {
  return PRESET_MODELS.find((model) => model.id === id)
    || PRESET_MODELS.find((model) => model.id === DEFAULT_MODEL_ID)
    || PRESET_MODELS[0]
}
