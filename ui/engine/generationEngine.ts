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

  private getAdapter(provider?: string): ImageProviderAdapter {
    if (provider === 'virse') {
      return this.virseAdapter
    }
    return this.apilioAdapter
  }

  /**
   * 测试 API 连接
   */
  async testConnection(profile: ApiProfile): Promise<ConnectionResult> {
    if (!profile) {
      return { success: false, message: '请先配置 API 参数' }
    }
    const adapter = this.getAdapter(profile.provider)
    return await adapter.testConnection(profile)
  }

  /**
   * 执行图像生成请求
   */
  async generate(
    request: GenerationRequest,
    profile: ApiProfile
  ): Promise<GenerationJob> {
    if (!profile || !profile.apiKey) {
      return {
        status: 'failed',
        error: {
          code: 'NO_API_KEY',
          message: '未发现 API Key，请点击顶部设置图标 ⚙ 配置 API 参数。',
        },
      }
    }

    const adapter = this.getAdapter(profile.provider)
    return await adapter.submit(request, profile)
  }
}

export const generationEngine = new GenerationEngine()
