import {
  GenerationRequest,
  GenerationJob,
  ConnectionResult,
  ImageProviderAdapter,
} from './types'
import { ApiProfile } from '@messages/sender'
import { ApilioAdapter } from './adapters/apilioAdapter'
import { VirseAdapter } from './adapters/virseAdapter'

export class GenerationEngine {
  private apilioAdapter = new ApilioAdapter()
  private virseAdapter = new VirseAdapter()

  private getAdapter(provider?: string): ImageProviderAdapter | null {
    if (provider === 'apilio') return this.apilioAdapter
    if (provider === 'virse') return this.virseAdapter
    return null
  }

  /**
   * 测试 API 连接
   */
  async testConnection(profile: ApiProfile, signal?: AbortSignal): Promise<ConnectionResult> {
    if (!profile) {
      return { success: false, message: '请先配置 API 参数' }
    }
    const adapter = this.getAdapter(profile.provider)
    if (!adapter) {
      return {
        success: false,
        message: `暂不支持服务提供商「${profile.provider || '未指定'}」，请选择柏拉图 API 或 Virse。`,
      }
    }
    return await adapter.testConnection(profile, signal)
  }

  /**
   * 执行图像生成请求
   */
  async generate(
    request: GenerationRequest,
    profile: ApiProfile,
    signal?: AbortSignal
  ): Promise<GenerationJob> {
    if (!profile) {
      return {
        status: 'failed',
        error: {
          code: 'NO_API_PROFILE',
          message: '未配置 API 参数，请先配置 API。',
        },
      }
    }

    const adapter = this.getAdapter(profile.provider)
    if (!adapter) {
      return {
        status: 'failed',
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: `暂不支持服务提供商「${profile.provider || '未指定'}」，请选择柏拉图 API 或 Virse。`,
        },
      }
    }

    if (!profile.apiKey) {
      return {
        status: 'failed',
        error: {
          code: 'NO_API_KEY',
          message: '未发现 API Key，请点击顶部设置图标 ⚙ 配置 API 参数。',
        },
      }
    }

    if (signal?.aborted) return { status: 'cancelled' }
    return await adapter.submit(request, profile, signal)
  }
}

export const generationEngine = new GenerationEngine()
