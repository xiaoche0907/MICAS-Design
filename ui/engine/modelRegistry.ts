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
    id: 'gpt-image-2',
    displayName: 'GPT Image 2',
    provider: 'apilio',
    modelId: 'gpt-image-2',
    protocol: 'openai-image',
    iconType: 'openai',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'nanobanana-2',
    displayName: 'Nanobanana 2',
    provider: 'apilio',
    modelId: 'gemini-3.1-flash-image-preview',
    protocol: 'gemini',
    iconType: 'google',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'nanobanana-pro',
    displayName: 'Nanobanana Pro',
    provider: 'apilio',
    modelId: 'nano-banana-pro',
    protocol: 'gemini',
    iconType: 'google',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['Original', '1:1', '2:3', '3:4', '4:5', '16:9', '9:16'],
    supportedResolutions: ['1K', '2K', '4K'],
  },
  {
    id: 'seedream-5-lite',
    displayName: 'Seedream 5',
    provider: 'apilio',
    modelId: 'seedream-v5-pro',
    protocol: 'openai-image',
    iconType: 'seedream',
    capabilities: { textToImage: true, imageToImage: true, multiImage: true },
    maxReferences: 10,
    supportedRatios: ['1:1', '2:3', '3:4', '16:9', '9:16'],
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
  'seedream-5-lite': [
    /^seedream[-_.]?v?5[-_.]?(?:pro|lite)?$/i,
    /seedream.*(?:v?5|5[.-]?0).*(?:pro|lite)?/i,
  ],
}

const matchesCanonicalModel = (canonicalId: string, model: ProviderModel): boolean => {
  const candidates = [model.id, model.name || ''].filter(Boolean)
  const exactTarget = PRESET_MODELS.find((preset) => preset.id === canonicalId)?.modelId || ''
  if (candidates.some((candidate) => normalizeModelText(candidate) === normalizeModelText(exactTarget))) return true
  return candidates.some((candidate) => (modelMatchers[canonicalId] || []).some((matcher) => matcher.test(candidate)))
}

/** Match provider-specific ids returned by Virse to the four canonical UI models. */
export const matchProviderModels = (models: ProviderModel[]): Record<string, string> => {
  const result: Record<string, string> = {}
  const usedIds = new Set<string>()
  for (const preset of PRESET_MODELS) {
    const matched = models.find((model) => !usedIds.has(model.id) && matchesCanonicalModel(preset.id, model))
    if (matched) {
      result[preset.id] = matched.id
      usedIds.add(matched.id)
    }
  }
  return result
}

export const getModelsForProfile = (profile: ApiProfile | null): ExtendedModelDefinition[] => {
  if (profile?.provider !== 'virse' || !profile.modelIdMap || Object.keys(profile.modelIdMap).length === 0) {
    return PRESET_MODELS
  }
  return PRESET_MODELS
    .filter((preset) => Boolean(profile.modelIdMap?.[preset.id]))
    .map((preset) => ({ ...preset, provider: 'virse', modelId: profile.modelIdMap![preset.id] }))
}

export function getModelById(id: string): ExtendedModelDefinition {
  return PRESET_MODELS.find((model) => model.id === id)
    || PRESET_MODELS.find((model) => model.id === DEFAULT_MODEL_ID)
    || PRESET_MODELS[0]
}
