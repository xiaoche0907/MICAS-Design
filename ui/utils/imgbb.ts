/**
 * ImgBB 图床 API v1 上传工具
 * 官方接口: POST https://api.imgbb.com/1/upload?key=YOUR_API_KEY
 */

export interface ImgBBResponse {
  data: {
    id: string
    title: string
    url_viewer: string
    url: string
    display_url: string
    width: string | number
    height: string | number
    size: string | number
    time: string | number
    expiration: string | number
    image?: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    thumb?: {
      url: string
    }
  }
  success: boolean
  status: number
}

/**
 * 将 Base64 或图片链接上传至 ImgBB 图床，返回公网直链 URL
 * @param imageData Base64 DataURL 或图片 URL
 * @param apiKey ImgBB API 密钥
 * @param name 可选文件名
 */
export async function uploadToImgBB(
  imageData: string,
  apiKey: string,
  name?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('未配置 ImgBB API Key')
  }

  // 避免对已经是 HTTP/HTTPS 的网络 URL 进行二次上传
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData
  }

  // 如果是 Base64，移除前缀 'data:image/...;base64,' 提取纯数据串
  let cleanBase64 = imageData
  if (imageData.includes('base64,')) {
    cleanBase64 = imageData.split('base64,')[1]
  }

  const endpoint = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`
  const formData = new FormData()
  formData.append('image', cleanBase64)
  if (name) {
    formData.append('name', name)
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`ImgBB 上传失败 [HTTP ${res.status}]: ${errText}`)
  }

  const json: ImgBBResponse = await res.json()
  if (!json.success || !json.data || !json.data.url) {
    throw new Error(`ImgBB 图床未返回有效数据: ${JSON.stringify(json)}`)
  }

  return json.data.url
}
