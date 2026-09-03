# 🎨 Imagen 3.0 (Nano Banana) 图片生成完整 Skills 手册

## 📑 目录

1. [核心参数详解](#1-核心参数详解)
2. [Prompt 工程完整指南](#2-prompt-工程完整指南)
3. [风格词典库](#3-风格词典库)
4. [场景化模板](#4-场景化模板)
5. [Negative Prompt 精准控制](#5-negative-prompt-精准控制)
6. [高级技巧与优化](#6-高级技巧与优化)
7. [故障排除指南](#7-故障排除指南)
8. [实战案例库](#8-实战案例库)

---

## 1. 核心参数详解

### 1.1 完整 API 请求结构

```json
{
  "model": "imagen-3.0-generate-001",
  "prompt": "你的详细描述",
  "config": {
    "numberOfImages": 1,
    "aspectRatio": "1:1",
    "negativePrompt": "不想要的元素",
    "personGeneration": "dont_allow",
    "safetyFilterLevel": "block_only_high",
    "outputMimeType": "image/jpeg",
    "outputCompressionQuality": 80,
    "language": "auto"
  }
}
```

### 1.2 参数深度解析

#### 📐 aspectRatio（宽高比）

| 比例 | 尺寸示例 | 最佳用途 | 适用场景 |
|------|---------|---------|---------|
| **1:1** | 1024×1024 | 社交媒体头像、Instagram 帖子 | 产品展示、人像、图标 |
| **3:4** | 768×1024 | 竖版海报、移动端展示 | 人物全身照、手机壁纸、App 界面 |
| **4:3** | 1024×768 | 传统照片、演示文稿 | 风景摄影、产品详情页 |
| **9:16** | 576×1024 | 短视频封面、Stories | TikTok、Instagram Reels、手机竖屏内容 |
| **16:9** | 1024×576 | 横向视频、网页 Banner | YouTube 封面、桌面壁纸、网站头图 |

**选择建议：**

- 人物肖像：`3:4` 或 `1:1`
- 风景：`16:9` 或 `4:3`
- 移动优先：`9:16`
- 通用/不确定：`1:1`

#### 🔢 numberOfImages（生成数量）

```python
# 策略建议
numberOfImages = 4  # 推荐：获得更多选择
numberOfImages = 1  # 仅当 prompt 高度精确时使用
```

**优势对比：**

- **生成 4 张**：提高成功率、获得风格变体、便于 A/B 测试
- **生成 1 张**：节省配额、适合批量生成场景

#### 👤 personGeneration（人物生成策略）

| 选项 | 说明 | 使用场景 |
|------|------|---------|
| `dont_allow` | 完全不生成人物 | 风景、产品、抽象艺术 |
| `allow_adult` | 仅生成成年人 | 商业摄影、专业场景 |
| `allow_all` | 允许所有年龄段 | 家庭场景、教育内容 |

**安全提示：**

- 涉及人物时务必设置此参数
- 商业用途建议使用 `allow_adult`
- 儿童内容需谨慎，遵守平台规范

#### 🛡️ safetyFilterLevel（安全过滤级别）

```
block_low_and_above (严格) 
    ↓ 可能误伤正常内容
block_medium_and_above (平衡) ⭐ 推荐
    ↓ 大多数场景适用
block_only_high (宽松)
    ↓ 用于艺术创作
```

**选择指南：**

- **教育/企业内容**：`block_low_and_above`
- **商业设计（推荐）**：`block_medium_and_above`
- **艺术探索**：`block_only_high`

#### 🖼️ outputMimeType（输出格式）

| 格式 | 优势 | 劣势 | 适用场景 |
|------|------|------|---------|
| `image/jpeg` | 文件小、加载快 | 无透明通道 | 照片、背景图、网页图片 |
| `image/png` | 支持透明、无损 | 文件大 | Logo、图标、需要抠图的素材 |

#### 🎚️ outputCompressionQuality（压缩质量）

```python
# 仅对 JPEG 有效
outputCompressionQuality = 100  # 最高质量（文件大）
outputCompressionQuality = 80   # 推荐：质量与体积平衡
outputCompressionQuality = 60   # 网页缩略图
```

---

## 2. Prompt 工程完整指南

### 2.1 黄金公式（7 要素法）

```
[主体描述] + [动作/状态] + [环境/场景] + [风格流派] + 
[光照描述] + [视角/构图] + [质量增强词]
```

### 2.2 要素详细拆解

#### 🎯 主体描述（Subject）

**原则：** 具体 > 抽象，细节 > 概括

```
❌ 差：A cat
✅ 好：A fluffy orange tabby cat with green eyes
✅ 更好：A young Maine Coon cat with long fluffy orange fur, 
      bright emerald green eyes, and white paws
```

**描述框架：**

- **物体/人物**：年龄、性别、特征
- **材质**：金属、木质、布料、玻璃
- **颜色**：具体色调（如 coral pink 而非 pink）
- **尺寸/比例**：大、小、细长、圆润

#### 🏃 动作/状态（Action）

```
静态：standing, sitting, floating, lying, positioned
动态：running, jumping, dancing, flying, flowing
情绪：smiling, laughing, contemplating, sleeping, alert
```

**示例对比：**

```
静态：A woman sitting elegantly on a velvet chair
动态：A dancer mid-leap, arms extended gracefully
```

#### 🌍 环境/场景（Environment）

```
室内：modern office, cozy bedroom, industrial warehouse, art gallery
室外：misty forest, sandy beach at sunset, urban street, mountain peak
抽象：gradient background, bokeh lights, infinite white void
```

**环境增强公式：**

```
[地点] + [时间] + [天气/氛围] + [周边元素]

示例：Ancient library at midnight, candlelit, dust particles floating, 
      rows of old books visible in shadows
```

#### 🎨 风格流派（Style）

**分类体系：**

**摄影类：**

```
- Portrait photography（人像摄影）
- Fashion photography（时尚摄影）
- Documentary style（纪实风格）
- Street photography（街头摄影）
- Architectural photography（建筑摄影）
- Macro photography（微距摄影）
- Long exposure（长曝光）
```

**绘画类：**

```
- Oil painting（油画）
- Watercolor（水彩）
- Acrylic painting（丙烯画）
- Ink wash painting（水墨画）
- Impressionism（印象派）
- Expressionism（表现主义）
- Cubism（立体主义）
- Art Nouveau（新艺术运动）
```

**数字艺术类：**

```
- Digital illustration（数字插画）
- 3D rendering（3D 渲染）
- Pixel art（像素艺术）
- Vector art（矢量艺术）
- Concept art（概念艺术）
- Matte painting（场景绘画）
```

**风格化类：**

```
- Anime style（动漫风格）
- Manga style（漫画风格）
- Cartoon style（卡通风格）
- Minimalist（极简主义）
- Maximalist（繁复主义）
- Retro/Vintage（复古风）
- Cyberpunk（赛博朋克）
- Steampunk（蒸汽朋克）
```

#### 💡 光照描述（Lighting）

**自然光：**

```
- Golden hour lighting（黄金时刻）
- Blue hour（蓝调时刻）
- Harsh midday sun（正午强光）
- Overcast soft light（阴天柔光）
- Dappled sunlight（斑驳阳光）
- Backlit/Rim lighting（逆光/轮廓光）
```

**人工光：**

```
- Studio lighting（棚拍灯光）
- Three-point lighting（三点布光）
- Dramatic side lighting（戏剧性侧光）
- Softbox lighting（柔光箱）
- Neon lights（霓虹灯）
- Candlelight（烛光）
- Fairy lights（串灯）
```

**氛围光：**

```
- Cinematic lighting（电影感光照）
- Moody lighting（情绪化光照）
- High key lighting（高调光）
- Low key lighting（低调光）
- Volumetric lighting（体积光/丁达尔效应）
```

**光照组合公式：**

```
[光源类型] + [方向] + [强度] + [色温]

示例：Soft morning sunlight from the right side, warm golden tones, 
      gentle shadows
```

#### 📷 视角/构图（Composition）

**镜头视角：**

```
- Eye-level shot（平视）
- Bird's eye view（俯视/鸟瞰）
- Worm's eye view（仰视）
- Dutch angle（荷兰角/倾斜）
- Over-the-shoulder（过肩镜头）
```

**景别：**

```
- Extreme close-up（大特写）
- Close-up（特写）
- Medium shot（中景）
- Full body shot（全身）
- Wide shot（远景）
- Establishing shot（全景）
```

**焦距/镜头：**

```
- Wide angle lens（广角镜头，14-35mm）
- Standard lens（标准镜头，50mm）
- Portrait lens（人像镜头，85mm）
- Telephoto lens（长焦镜头，200mm+）
- Fisheye lens（鱼眼镜头）
```

**构图法则：**

```
- Rule of thirds（三分法则）
- Golden ratio（黄金比例）
- Centered composition（居中构图）
- Leading lines（引导线）
- Symmetrical（对称构图）
- Frame within frame（框中框）
```

**景深：**

```
- Shallow depth of field, f/1.8（浅景深，背景虚化）
- Deep depth of field, f/16（大景深，全清晰）
- Bokeh background（焦外散景）
- Tilt-shift effect（移轴效果）
```

#### ⭐ 质量增强词（Quality Boosters）

**通用增强：**

```
high resolution, 8K, ultra HD, professional quality, award-winning, 
masterpiece, highly detailed, intricate details, sharp focus, crisp, 
photorealistic, hyperrealistic, studio quality
```

**特定类型增强：**

**摄影类：**

```
professional photography, shot on Canon EOS R5, 85mm f/1.4, 
RAW photo, editorial quality, magazine cover worthy
```

**插画类：**

```
trending on ArtStation, featured on Behance, professional illustration, 
published work, gallery quality
```

**产品类：**

```
commercial photography, product shot, e-commerce quality, 
clean and professional, marketing material
```

---

## 3. 风格词典库

### 3.1 摄影风格完整列表

#### 📸 人像摄影子类（续）

```yaml
Fashion Editorial:
  - high fashion pose
  - dramatic lighting
  - designer clothing
  - editorial makeup
  - strong styling
  - Vogue/Harper's Bazaar style

Lifestyle Portrait:
  - candid moment
  - natural environment
  - authentic expression
  - storytelling composition
  - real-life scenario

Beauty Photography:
  - focus on face/makeup
  - flawless skin
  - perfect lighting
  - close-up shot
  - beauty dish lighting

Environmental Portrait:
  - subject in their element
  - contextual background
  - tells a story
  - balanced with environment
  - documentary feel

Fine Art Portrait:
  - artistic interpretation
  - creative lighting
  - conceptual approach
  - painterly quality
  - emotional depth
```

#### 🏞️ 风景/场景摄影

```yaml
Landscape Photography:
  - dramatic sky
  - foreground interest
  - golden hour or blue hour
  - wide angle perspective
  - depth and layers
  - HDR processing

Cityscape/Urban:
  - architectural lines
  - urban geometry
  - street level or elevated view
  - night lights or day contrast
  - modern or historical feel

Aerial Photography:
  - bird's eye view
  - patterns from above
  - geographical features
  - drone perspective
  - abstract compositions

Seascape:
  - long exposure water
  - coastal elements
  - horizon line placement
  - wave motion or calm
  - sunrise/sunset colors

Astrophotography:
  - milky way visible
  - star trails
  - dark sky
  - silhouette foreground
  - long exposure
```

#### 📦 产品摄影

```yaml
E-commerce Product:
  - pure white background
  - multiple angles
  - sharp focus
  - even lighting
  - no shadows
  - clean and clinical

Lifestyle Product:
  - product in use
  - natural setting
  - storytelling context
  - relatable scenario
  - soft natural lighting

Luxury Product:
  - dramatic lighting
  - premium feel
  - elegant composition
  - rich textures
  - sophisticated backdrop
  - reflection surfaces

Food Photography:
  - overhead or 45-degree angle
  - natural daylight
  - props and styling
  - fresh and appetizing
  - shallow depth of field
  - rustic or modern setup

Flat Lay:
  - directly overhead
  - organized arrangement
  - complementary items
  - clean background
  - Instagram aesthetic
```

### 3.2 艺术风格细分

#### 🎨 经典艺术流派

```yaml
Renaissance (文艺复兴):
  - classical composition
  - chiaroscuro lighting
  - religious or mythological themes
  - oil painting technique
  - detailed realism
  - golden ratio composition

Baroque (巴洛克):
  - dramatic contrast
  - dynamic movement
  - rich colors
  - ornate details
  - emotional intensity
  - theatrical lighting

Impressionism (印象派):
  - visible brushstrokes
  - light and color focus
  - outdoor scenes
  - fleeting moments
  - soft edges
  - vibrant palette

Post-Impressionism (后印象派):
  - bold colors
  - thick paint application
  - symbolic content
  - geometric forms
  - expressive style

Expressionism (表现主义):
  - emotional distortion
  - intense colors
  - exaggerated forms
  - psychological depth
  - subjective perspective

Surrealism (超现实主义):
  - dreamlike imagery
  - unexpected combinations
  - symbolic elements
  - illogical scenarios
  - subconscious themes
  - Dalí or Magritte style

Art Deco (装饰艺术):
  - geometric patterns
  - luxurious materials
  - symmetrical designs
  - bold colors
  - streamlined forms
  - 1920s-1930s aesthetic

Pop Art (波普艺术):
  - bold colors
  - commercial imagery
  - repetition
  - flat graphic style
  - Warhol or Lichtenstein style
  - mass culture references
```

#### 🖌️ 现代/当代风格

```yaml
Abstract Expressionism:
  - gestural brushwork
  - color field
  - non-representational
  - emotional spontaneity
  - large scale feeling

Minimalism (极简主义):
  - simple geometric forms
  - limited color palette
  - negative space
  - clean lines
  - "less is more"
  - reduced elements

Maximalism (繁复主义):
  - abundant details
  - rich patterns
  - bold colors
  - layered elements
  - eclectic mix
  - "more is more"

Low Poly (低多边形):
  - geometric facets
  - angular shapes
  - limited color per polygon
  - 3D appearance
  - modern digital aesthetic

Vaporwave (蒸汽波):
  - pastel colors (pink, cyan, purple)
  - retro 80s-90s elements
  - glitch effects
  - classical sculptures
  - Japanese text
  - nostalgic aesthetic

Synthwave (合成波):
  - neon colors (pink, purple, cyan)
  - 80s retro-futuristic
  - grid landscapes
  - sunset gradients
  - palm trees
  - chrome and laser effects

Glitch Art (故障艺术):
  - digital distortion
  - pixel sorting
  - color channel separation
  - data corruption aesthetic
  - technological errors
```

#### 🌏 文化/地域风格

```yaml
Japanese Ukiyo-e (浮世绘):
  - woodblock print style
  - flat color blocks
  - bold outlines
  - natural subjects
  - Hokusai or Hiroshige style

Chinese Ink Wash (水墨画):
  - black ink gradations
  - bamboo or mountain subjects
  - minimalist composition
  - flowing brushwork
  - empty space emphasis

Art Nouveau (新艺术运动):
  - organic flowing lines
  - natural forms
  - decorative patterns
  - Mucha style
  - elegant curves
  - floral motifs

Nordic/Scandinavian:
  - clean minimalism
  - natural materials
  - muted color palette
  - functional design
  - hygge atmosphere

Tropical/Tiki:
  - vibrant colors
  - exotic plants
  - retro mid-century
  - paradise aesthetic
  - bold patterns
```

### 3.3 数字艺术风格

```yaml
Concept Art:
  - professional game/film quality
  - detailed environment
  - atmospheric perspective
  - dynamic composition
  - storytelling focus

Matte Painting:
  - cinematic quality
  - photorealistic elements
  - grand scale
  - seamless integration
  - fantasy or sci-fi landscapes

Character Design:
  - turnaround view
  - clear silhouette
  - personality expression
  - detailed costume
  - professional game art

Isometric Art:
  - 30-degree angle
  - pixel perfect or vector
  - game-like quality
  - clean geometric
  - city or room layouts

2.5D Art:
  - layered parallax
  - depth illusion
  - side-scrolling game style
  - paper cut effect
  - dimensional feeling

Pixel Art:
  - 8-bit or 16-bit style
  - limited color palette
  - retro gaming aesthetic
  - dithering technique
  - crisp edges
```

---

## 4. 场景化模板

### 4.1 商业应用模板

#### 💼 企业/品牌

**公司官网头图**

```
Prompt 模板：
Modern [industry] office interior, [time of day], professional team 
collaborating around a conference table, floor-to-ceiling windows with 
city view, natural daylight, clean corporate aesthetic, [brand colors], 
wide angle shot, architectural photography, high-end commercial quality

示例：
Modern tech startup office interior, mid-morning, diverse professional 
team collaborating around a glass conference table, floor-to-ceiling 
windows with San Francisco skyline view, natural daylight, clean 
minimalist aesthetic, blue and white color scheme, wide angle shot, 
architectural photography, high-end commercial quality

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "personGeneration": "allow_adult",
  "negativePrompt": "cluttered, messy, outdated, empty, sterile"
}
```

**产品发布 Key Visual**

```
Prompt 模板：
[Product] elegantly displayed on [surface], [background description], 
dramatic spotlight from [direction], professional product photography, 
premium feel, [brand aesthetic], reflective surface, ultra sharp details, 
commercial advertising style, [color scheme]

示例：
Luxury smartwatch elegantly displayed on black marble pedestal, 
gradient dark blue to purple background, dramatic spotlight from 
top-right creating subtle shadows, professional product photography, 
premium feel, minimalist modern aesthetic, reflective surface showing 
watch face, ultra sharp details, commercial advertising style, 
metallic silver and deep black colors

Config:
{
  "aspectRatio": "1:1",
  "numberOfImages": 4,
  "outputMimeType": "image/png",
  "negativePrompt": "cheap looking, cluttered, low resolution, scratches, fingerprints"
}
```

#### 🛍️ 电商/零售

**主图（白底）**

```
Prompt 模板：
[Product] on pure white background, centered composition, multiple 
angles visible, even studio lighting, no shadows, sharp focus on 
product, e-commerce photography, clean and professional, commercial 
quality, 8K resolution

示例：
Ceramic coffee mug with matte finish on pure white background, 
centered composition, slight 3/4 angle showing handle, even studio 
lighting, no shadows, sharp focus on product texture, e-commerce 
photography, clean and professional, commercial quality, 8K resolution

Config:
{
  "aspectRatio": "1:1",
  "numberOfImages": 4,
  "outputMimeType": "image/jpeg",
  "outputCompressionQuality": 90,
  "negativePrompt": "shadows, background elements, reflections, uneven lighting"
}
```

**场景图（生活方式）**

```
Prompt 模板：
[Product] in natural use setting, [context scene], [user interaction], 
soft natural window light, lifestyle photography, authentic moment, 
[mood/atmosphere], shallow depth of field with product in focus, 
editorial quality, relatable and aspirational

示例：
Wireless headphones on wooden desk next to laptop, cozy home office 
setup, morning coffee beside keyboard, soft natural window light from 
left, lifestyle photography, authentic work-from-home moment, calm 
and productive atmosphere, shallow depth of field with headphones in 
focus, editorial quality, relatable and aspirational, warm tones

Config:
{
  "aspectRatio": "4:3",
  "numberOfImages": 4,
  "negativePrompt": "artificial, staged, cluttered, distracting background"
}
```

#### 📱 社交媒体内容

**Instagram Post**

```
Prompt 模板：
[Subject] in [setting], [aesthetic style], visually striking composition, 
[color palette], Instagram-worthy, social media optimized, engaging 
and shareable, [mood], perfect for feed aesthetic

示例：
Flat lay of healthy breakfast bowl with fresh berries and granola, 
marble countertop, minimalist aesthetic, visually striking overhead 
composition, soft pastel color palette with pinks and whites, 
Instagram-worthy, social media optimized, engaging and shareable, 
fresh morning vibe, perfect for wellness feed aesthetic

Config:
{
  "aspectRatio": "1:1",
  "numberOfImages": 4,
  "negativePrompt": "messy, unappetizing, dark, cluttered"
}
```

**Story/Reel 封面**

```
Prompt 模板：
[Subject] vertical composition, bold and eye-catching, [text space area] 
for overlay, vibrant colors, mobile-first design, attention-grabbing, 
[style], short-form content optimized

示例：
Young woman holding smartphone showing app interface, vertical 
composition, bold and eye-catching, upper third clear space for text 
overlay, vibrant teal and coral colors, mobile-first design, 
attention-grabbing, energetic lifestyle style, short-form content 
optimized, direct eye contact with camera

Config:
{
  "aspectRatio": "9:16",
  "numberOfImages": 4,
  "personGeneration": "allow_adult",
  "negativePrompt": "boring, low energy, cluttered center, text in image"
}
```

### 4.2 创意设计模板

#### 🎭 概念艺术

**奇幻场景**

```
Prompt 模板：
[Fantasy element] in [environment], [time/weather], [magical elements],
epic scale, cinematic composition, [art style], detailed matte painting,
concept art quality, dramatic lighting, rich atmosphere, [color mood]

示例：
Ancient floating islands connected by ethereal bridges in vast sky realm,
golden sunset with purple storm clouds, glowing runes on stone structures,
epic scale, cinematic wide shot, painterly fantasy art style, detailed 
matte painting, concept art quality, dramatic volumetric lighting rays,
rich mystical atmosphere, warm oranges contrasting cool purples

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "negativePrompt": "modern elements, cars, phones, realistic photography, mundane"
}
```

**科幻场景**

```
Prompt 模板：
[Sci-fi setting] with [technology elements], [time period feel],
[architectural style], futuristic atmosphere, cyberpunk/solarpunk aesthetic,
neon lights and [dominant colors], cinematic sci-fi concept art,
high-tech details, [weather/environment], blade runner inspired

示例：
Towering megacity at night with holographic advertisements, flying cars
between skyscrapers, rain-slicked streets reflecting neon, art deco meets
high-tech architectural style, cyberpunk noir atmosphere, neon pink and
cyan lights against dark buildings, cinematic sci-fi concept art, intricate
high-tech details visible, heavy rain with mist, Blade Runner inspired

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "negativePrompt": "bright sunny, natural, rural, low-tech, medieval"
}
```

#### 🎨 插画设计

**儿童绘本风格**

```
Prompt 模板：
[Character/scene] in children's book illustration style, [action/emotion],
soft rounded shapes, bright cheerful colors, friendly and approachable,
[medium: watercolor/digital/gouache], whimsical details, clear composition,
published quality, award-winning children's book art

示例：
Curious little fox exploring enchanted forest in children's book illustration
style, looking up at glowing fireflies with wonder, soft rounded shapes,
bright warm colors with golden sunlight, friendly and approachable character
design, digital painting with watercolor texture, whimsical mushrooms and
flowers, clear readable composition, published quality, Caldecott award style

Config:
{
  "aspectRatio": "4:3",
  "numberOfImages": 4,
  "negativePrompt": "scary, dark, realistic, sharp edges, complex details"
}
```

**扁平插画（Flat Design）**

```
Prompt 模板：
[Subject] in flat design illustration style, geometric shapes, limited
color palette of [colors], vector art aesthetic, clean lines, modern
minimalist, no gradients, [composition type], graphic design quality

示例：
Coworking space scene in flat design illustration style, simplified people
at desks with laptops, geometric furniture shapes, limited color palette
of navy blue, coral pink, mint green and cream, vector art aesthetic,
clean lines, modern minimalist, no gradients or shadows, isometric view,
tech startup graphic design quality

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "negativePrompt": "realistic, 3D, shadows, gradients, textures, photographic"
}
```

**手绘水彩风格**

```
Prompt 模板：
[Subject] in delicate watercolor painting style, [colors] with soft
washes, loose brushwork, white paper texture visible, [mood/feeling],
artistic and painterly, traditional medium feel, fluid and organic

示例：
Botanical garden flowers in delicate watercolor painting style, soft
pinks, lavenders and greens with transparent washes, loose expressive
brushwork, white paper texture visible in highlights, serene spring
feeling, artistic and painterly, traditional watercolor medium feel,
fluid and organic edges bleeding naturally

Config:
{
  "aspectRatio": "3:4",
  "numberOfImages": 4,
  "negativePrompt": "digital, sharp edges, solid colors, graphic, vector"
}
```

### 4.3 内容创作模板

#### 📰 编辑/出版

**杂志封面**

```
Prompt 模板：
[Subject] for magazine cover, [pose/expression], [fashion/styling],
professional editorial photography, [magazine type] aesthetic, strong
visual impact, cover-worthy composition, space for masthead at top,
high fashion quality, studio or location lighting

示例：
Confident businesswoman in power suit for magazine cover, direct gaze
at camera with subtle smile, modern tailored navy blazer, professional
editorial photography, Forbes/Fortune aesthetic, strong visual impact,
waist-up centered composition with negative space at top for masthead,
high fashion quality, dramatic side lighting creating dimension

Config:
{
  "aspectRatio": "3:4",
  "numberOfImages": 4,
  "personGeneration": "allow_adult",
  "negativePrompt": "casual, messy, unfocused, cluttered background"
}
```

**文章配图**

```
Prompt 模板：
Editorial illustration representing [concept/theme], metaphorical visual,
[color scheme], clean composition suitable for article layout, contemporary
illustration style, thought-provoking imagery, magazine editorial quality

示例：
Editorial illustration representing digital transformation in business,
metaphorical visual of person climbing stairs made of digital pixels
transitioning to solid structure, blue and orange color scheme, clean
centered composition suitable for article layout, contemporary flat
illustration style, thought-provoking imagery, The Economist quality

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "negativePrompt": "literal, photographic, cluttered, confusing composition"
}
```

#### 🎬 视频/动画

**YouTube 缩略图**

```
Prompt 模板：
Bold [subject] for YouTube thumbnail, [emotion/action], vibrant high
contrast colors, clear focal point, clickable and attention-grabbing,
space for large text overlay, dramatic expression, energetic composition

示例：
Shocked person with hands on face for YouTube thumbnail, exaggerated
surprised expression with wide eyes, vibrant red and yellow high contrast
background, clear centered face as focal point, clickable and attention-
grabbing, left third clear space for large text overlay, dramatic lighting
on face, energetic close-up composition

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "personGeneration": "allow_adult",
  "negativePrompt": "subtle, low contrast, small details, boring, calm"
}
```

**动画背景**

```
Prompt 模板：
[Environment] background for 2D animation, [perspective], parallax layers,
stylized art style, [color palette], clean linework, [atmosphere/mood],
animation production quality, suitable for character overlay

示例：
Cozy coffee shop interior background for 2D animation, side view perspective
with depth, multiple parallax layers (foreground tables, mid counter, back
wall), stylized anime art style, warm brown and cream color palette, clean
crisp linework, relaxing afternoon atmosphere, high-end animation production
quality, suitable for character overlay with clear negative space

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "negativePrompt": "photorealistic, cluttered, characters visible, text"
}
```

### 4.4 个人创作模板

#### 🖼️ 艺术打印

**墙面装饰画**

```
Prompt 模板：
[Subject] in [art style], suitable for wall art print, [composition],
[color harmony], museum quality, frameable artwork, [size feel: intimate
or grand], timeless aesthetic, home decor suitable

示例：
Abstract mountain landscape in minimalist geometric style, suitable for
wall art print, horizontal panoramic composition, monochromatic navy blue
with gold accent lines, museum quality, frameable artwork, large scale
grand feeling, timeless Nordic aesthetic, modern home decor suitable

Config:
{
  "aspectRatio": "16:9",
  "numberOfImages": 4,
  "negativePrompt": "busy, dated, photographic, trendy, kitschy"
}
```

**数字壁纸**

```
Prompt 模板：
[Theme] wallpaper design, [device: desktop/mobile], [resolution feel],
[aesthetic], non-distracting background, [color mood], suitable for
extended viewing, clean areas for icons/widgets

示例：
Serene Japanese zen garden wallpaper design, desktop widescreen format,
ultra high resolution detail, minimalist peaceful aesthetic, soft muted
greens and grays, non-distracting subtle background, calming mood suitable
for extended work viewing, clean negative space in center and corners for
desktop icons

Config:
{
  "aspectRatio": "16:9",  # desktop
  # "aspectRatio": "9:16", # mobile
  "numberOfImages": 4,
  "negativePrompt": "busy center, high contrast, distracting details, text"
}
```

#### 🎁 个性化内容

**头像/Profile 图**

```
Prompt 模板：
[Subject/character] portrait for profile picture, [style], clear
recognizable features, works at small size, [expression/mood],
simple background, avatar suitable, social media ready

示例：
Friendly robot character portrait for profile picture, cute minimalist
vector style, clear geometric features with round shapes, works at
thumbnail size, cheerful expression with glowing eyes, solid gradient
blue background, avatar suitable, social media platform ready

Config:
{
  "aspectRatio": "1:1",
  "numberOfImages": 4,
  "negativePrompt": "complex details, busy background, unclear at small size"
}
```

**贺卡/邀请函**

```
Prompt 模板：
[Occasion] greeting card design, [theme/season], elegant composition,
[color scheme], space for text message, festive/celebratory mood,
printable quality, [style: modern/traditional/whimsical]

示例：
Spring wedding invitation card design, cherry blossom theme, elegant
vertical composition with floral border frame, soft blush pink and
sage green color scheme, generous white space in center for text
message, romantic celebratory mood, high resolution printable quality,
modern watercolor illustration style

Config:
{
  "aspectRatio": "3:4",
  "numberOfImages": 4,
  "negativePrompt": "cluttered center, dark, text visible, busy"
}
```

---

## 5. Negative Prompt 精准控制

### 5.1 通用排除词库

#### 🚫 质量问题

```
Low Quality Issues:
blurry, out of focus, low resolution, pixelated, low quality, bad quality,
poor quality, amateur, unprofessional, jpeg artifacts, compression artifacts,
grainy, noisy, distorted, deformed

Technical Flaws:
overexposed, underexposed, bad lighting, harsh shadows, incorrect white balance,
color banding, chromatic aberration, lens flare (if unwanted), vignette (if unwanted)

Unwanted Elements:
watermark, logo, signature, text, username, copyright, border, frame (if unwanted),
date stamp, camera info
```

#### 👤 人物相关排除

```
Anatomy Issues:
bad anatomy, bad proportions, extra limbs, missing limbs, extra fingers,
missing fingers, fused fingers, too many fingers, extra arms, extra legs,
malformed hands, mutated hands, poorly drawn hands, poorly drawn face,
disfigured, deformed, ugly face

Body Issues:
long neck, long body, stretched torso, disproportionate, asymmetrical face,
lazy eye, cross-eyed, cloned face, duplicate person

Age/Appearance (如需限制):
child, kid, young, elderly, old (根据需求选择)
```

#### 🎨 风格冲突排除

```
Style Conflicts:
realistic, photorealistic (当需要插画风格时)
cartoon, anime, illustrated (当需要照片风格时)
3D render, CGI (当需要2D时)
abstract (当需要具象时)
minimalist (当需要丰富细节时)
busy, cluttered (当需要简洁时)

Unwanted Art Styles:
amateur drawing, child's drawing, MS Paint, crude, sketchy (unless wanted),
unfinished, draft, concept sketch (unless wanted)
```

#### 🌈 颜色/氛围排除

```
Color Issues:
oversaturated, desaturated, monochrome (unless wanted), black and white (unless wanted),
washed out colors, muddy colors, color bleeding

Mood/Atmosphere:
dark, gloomy, depressing (when wanting upbeat)
bright, cheerful (when wanting moody)
chaotic, messy, cluttered (when wanting organized)
sterile, clinical, cold (when wanting warm/cozy)
```

### 5.2 场景特定 Negative Prompts

#### 💼 商业/产品摄影

```
Product Photography:
"cluttered background, distracting elements, uneven lighting, shadows on product,
reflections (unless intentional), fingerprints, dust, scratches, dents,
packaging visible (unless wanted), price tags, barcodes, brand logos (if generic),
motion blur, soft focus, low resolution"

Corporate/Business:
"casual attire (if formal needed), messy environment, personal items visible,
outdated technology, empty office, too staged, stock photo feel, fake smiles,
uncomfortable poses, bad posture"
```

#### 🎨 创意/艺术

```
Illustration:
"photorealistic, 3D render, blurry, sketchy outlines (unless wanted),
unfinished areas, inconsistent style, mixed media (unless wanted),
traced photo look, AI-generated feel"

Fine Art:
"digital, computer generated (unless wanted), commercial, stock art,
generic, cliché, derivative, uninspired, bland composition"
```

#### 👥 人物肖像

```
Portrait Photography:
"unflattering angle, double chin, red eyes, shiny skin, visible pores (for beauty),
messy hair (unless intentional), wrinkled clothing, awkward expression,
forced smile, looking away (unless intentional), cropped head, cut-off body parts"

Fashion Photography:
"casual clothing (if high fashion), poor posture, unflattering pose,
cluttered background, distracting props, bad styling, mismatched colors,
dated fashion, cheap looking"
```

#### 🏞️ 风景/场景

```
Landscape:
"people (unless wanted), man-made structures (unless wanted), power lines,
trash, pollution, overcast (unless wanted), flat lighting, boring composition,
center horizon, no foreground interest, motion blur"

Interior:
"messy, cluttered, cables visible, personal photos, dated decor,
poor lighting, dark corners, unorganized, dirty, stains"
```

### 5.3 Negative Prompt 组合策略

#### 📋 分层叠加法

```python
# 基础层 - 始终包含
base_negative = "blurry, low quality, distorted, bad anatomy, watermark"

# 场景层 - 根据内容类型添加
scene_negative = {
    "portrait": "extra limbs, deformed face, bad proportions",
    "product": "cluttered, shadows, uneven lighting",
    "landscape": "people, buildings, power lines",
    "illustration": "photorealistic, 3D render, photograph"
}

# 风格层 - 排除冲突风格
style_negative = {
    "professional": "amateur, low quality, unprofessional",
    "minimalist": "cluttered, busy, excessive details",
    "realistic": "cartoon, anime, illustrated, abstract"
}

# 组合公式
final_negative = f"{base_negative}, {scene_negative[type]}, {style_negative[style]}"
```

#### 🎯 优先级排序

```
高优先级（严重影响）：
bad anatomy, extra limbs, deformed, disfigured, blurry, low quality

中优先级（明显影响）：
watermark, text, wrong style, poor lighting, cluttered

低优先级（细微调整）：
specific unwanted colors, minor composition issues, subtle mood adjustments
```

---

## 6. 高级技巧与优化

### 6.1 Prompt 权重与强调

#### 📊 隐式权重技巧

```
位置权重（Imagen 对前部内容更敏感）：
✅ "Golden retriever puppy, fluffy fur, in a flower garden" 
   （主体在前）

❌ "In a flower garden, there is a golden retriever puppy with fluffy fur"
   （主体在后，可能被弱化）

重复强调：
"Ultra detailed, highly detailed, intricate details" 
（通过相似词重复强调细节）

具体化强调：
❌ "beautiful lighting"
✅ "soft golden hour lighting from the left, warm rim light, gentle shadows"
```

#### 🔢 描述符密度

```
低密度（可能模糊）：
"A cat in a room"

中密度（推荐）：
"A fluffy orange tabby cat sitting on a wooden chair in a cozy living room"

高密度（可能过约束）：
"A fluffy orange tabby cat with green eyes and white paws sitting elegantly 
on an antique wooden chair with carved details in a cozy Scandinavian-style 
living room with white walls and plants"

建议：50-150 词为最佳范围
```

### 6.2 迭代优化流程

#### 🔄 三步优化法

```
第一次生成 - 基础探索：
Prompt: 简洁描述核心要素
Config: numberOfImages = 4, 标准设置
目的: 确定大方向是否正确

第二次生成 - 精细化：
Prompt: 在满意方向上增加细节描述
Negative: 添加第一次中出现的问题元素
目的: 优化细节和排除错误

第三次生成 - 完美调整：
Prompt: 微调具体描述词
Negative: 进一步精准排除
Config: 可能调整 aspectRatio 或其他参数
目的: 达到最终效果
```

#### 📝 版本对比记录

```
Version 1:
Prompt: "Modern office interior"
Result: 太空旷，缺少人物
Issues: Empty, sterile feeling

Version 2:
Prompt: "Modern office interior with people working"
Negative: "empty, sterile"
Result: 人物太多，杂乱
Issues: Overcrowded

Version 3:
Prompt: "Modern office interior with 2-3 people collaborating at distance"
Negative: "empty, sterile, crowded, too many people"
Result: ✅ 平衡感好
```

### 6.3 A/B 测试策略

#### 🧪 变量测试法

```
测试单一变量（推荐）：

Test A - 光照变化：
- Prompt A: "...soft morning light..."
- Prompt B: "...dramatic evening light..."
- 其他部分完全相同

Test B - 视角变化：
- Config A: aspectRatio = "16:9"
- Config B: aspectRatio = "9:16"
- Prompt 完全相同

Test C - 风格变化：
- Prompt A: "...photorealistic style..."
- Prompt B: "...illustrated style..."
- 其他部分完全相同
```

#### 📊 结果评估矩阵

```
评估维度：
1. 主题准确性 (1-5分)
2. 构图美感 (1-5分)
3. 技术质量 (1-5分)
4. 创意独特性 (1-5分)
5. 使用场景适配度 (1-5分)

记录格式：
Version | 维度1 | 维度2 | 维度3 | 维度4 | 维度5 | 总分
---------|-------|-------|-------|-------|-------|-----
   A     |   4   |   3   |   5   |   3   |   4   | 19
   B     |   5   |   5   |   4   |   4   |   5   | 23 ✅
```

### 6.4 常见问题解决方案

#### ❓ 问题诊断表

```
问题：生成结果模糊/不清晰
原因：Prompt 缺少质量描述词
解决：添加 "sharp focus, high resolution, detailed, 8K, crisp"

问题：颜色不符合预期
原因：颜色描述不够具体
解决：使用具体色彩名称 "coral pink" 而非 "pink"，或添加色调描述

问题：构图被裁切
原因：aspectRatio 选择不当
解决：根据主体形态选择合适比例（人物竖版3:4，风景横版16:9）

问题：风格不统一
原因：Prompt 中包含冲突的风格词
解决：统一风格方向，在 negative 中排除冲突风格

问题：人物面部/手部畸形
原因：复杂姿势或角度
解决：简化姿势描述，添加 negative: "bad anatomy, deformed hands"

问题：出现不想要的元素
原因：Prompt 描述引发联想
解决：在 negativePrompt 中明确排除

问题：整体氛围不对
原因：缺少光照和情绪描述
解决：添加详细光照描述和氛围形容词

问题：生成结果重复性高
原因：Prompt 过于具体限制了创造性
解决：适当放宽描述，增加创意空间

问题：主体不突出
原因：背景描述过多
解决：将主体描述放在 prompt 前部，减少背景细节

问题：看起来像 AI 生成
原因：过度完美或常见 AI 特征
解决：添加 "natural imperfections, authentic, candid moment"
```

---

## 7. 故障排除指南

### 7.1 内容被安全过滤器拦截

#### 🛡️ 常见拦截原因

```
过于写实的人体描述：
❌ "naked, nude, revealing clothing"
✅ "wearing elegant dress, modest attire"

暴力/危险元素：
❌ "blood, gore, weapons, fighting"
✅ "action scene, dynamic pose" (避免明确暴力)

敏感主题：
❌ 真实政治人物、宗教争议、种族刻板印象
✅ 通用角色、中性描述

解决方案：
1. 降低 safetyFilterLevel 到 "block_only_high"（仅适用于艺术创作）
2. 使用更委婉的描述词汇
3. 避免直接描述敏感内容
```

#### 🔧 改写示例

```
原始（可能被拦截）：
"Warrior with sword and blood on armor in battle"

改写（通过概率高）：
"Medieval knight in weathered armor, holding ceremonial sword, 
heroic fantasy art style, dramatic pose"

原始（可能被拦截）：
"Scary horror scene with monster"

改写（通过概率高）：
"Mysterious creature in dark atmospheric environment, 
gothic fantasy style, moody lighting"
```

### 7.2 结果不符合预期的调试流程

#### 🔍 系统化排查法

```
Step 1: 检查 Prompt 基础
□ 主体描述是否清晰？
□ 是否包含冲突的风格词？
□ 长度是否合适（50-150词）？
□ 关键词是否在前部？

Step 2: 检查 Config 参数
□ aspectRatio 是否适合内容？
□ personGeneration 是否正确设置？
□ numberOfImages 是否足够（建议4张）？

Step 3: 分析 Negative Prompt
□ 是否包含通用质量排除词？
□ 是否排除了冲突风格？
□ 是否针对场景添加了特定排除？

Step 4: 风格一致性
□ 摄影 vs 插画风格是否明确？
□ 写实 vs 抽象程度是否清晰？
□ 时代风格（现代/复古）是否统一？

Step 5: 细节层次
□ 是否过于宽泛（"a room"）？
□ 是否过于具体（限制创造力）？
□ 平衡点：具体的主体 + 灵活的细节
```

#### 🎯 问题场景速查

**场景1：主体错误**

```
症状：生成的主体不是想要的
原因：主体描述不够明确或位置靠后
解决：
- 将主体放在 Prompt 开头
- 增加主体的具体特征描述
- 在 negative 中排除不想要的主体
```

**场景2：风格错乱**

```
症状：摄影风格变成插画，或风格混杂
原因：风格关键词不够强或有冲突
解决：
- 明确添加 "photorealistic photography" 或 "digital illustration"
- Negative 中排除冲突风格："cartoon, illustrated" 或 "photographic"
- 增加风格相关的质量词
```

**场景3：构图问题**

```
症状：主体被裁切、位置不佳、比例失调
原因：aspectRatio 不匹配或构图描述缺失
解决：
- 调整 aspectRatio 适配主体（人像用3:4，风景用16:9）
- 添加构图描述："centered composition" "rule of thirds"
- 明确景别："close-up" "full body shot" "wide angle"
```

**场景4：光照不理想**

```
症状：过暗、过亮、光线平淡
原因：光照描述缺失或不够具体
解决：
- 添加详细光源："golden hour sunlight from left"
- 指定光照风格："soft diffused light" "dramatic spotlight"
- 描述光照效果："rim lighting" "volumetric rays"
```

**场景5：色彩偏差**

```
症状：颜色不符合预期或过于灰暗
原因：色彩描述不够明确
解决：
- 使用具体色彩名："teal blue" "burnt orange" "sage green"
- 添加色调描述："vibrant colors" "muted pastel palette"
- 排除不想要的色调："desaturated, monochrome, washed out"
```

**场景6：细节不足/过度**

```
症状：图像太简单或过于复杂混乱
原因：细节层次描述不平衡
解决：
细节不足时添加：
"highly detailed, intricate details, rich textures"

过度复杂时：
- 简化 Prompt 描述
- Negative 添加："cluttered, busy, overcomplicated"
- 强调重点："focus on [主体], simple background"
```

### 7.3 性能与效率优化

#### ⚡ 快速迭代技巧

```
技巧1：模板化常用场景
创建个人模板库：
- 人像模板A（商务风格）
- 产品模板B（白底电商）
- 风景模板C（自然风光）

每次仅修改变量部分，保持结构稳定

技巧2：批量测试参数
一次生成时同时测试多个小变化：
Run 1: numberOfImages=4, 观察风格变体
Run 2: 根据最佳结果微调

技巧3：记录成功案例
建立个人 Prompt 库：
场景类型 | 最佳 Prompt | Config | Negative | 备注

技巧4：善用 numberOfImages=4
同一 Prompt 生成4张，从中选择最佳
比重新生成多次更高效
```

#### 💰 配额管理策略

```
优先级分配：
高优先级任务：numberOfImages = 4，多次迭代
中优先级任务：numberOfImages = 2-3
低优先级/测试：numberOfImages = 1

批处理思维：
一次性准备好所有 Prompt 变体
集中生成，避免频繁修改

复用与变化：
基础场景生成后，通过细微调整创造变体
而非每次从零开始
```

---

## 8. 实战案例库

### 8.1 完整项目案例

#### 📱 案例A：移动App启动页设计

**需求分析**

```
项目：健康饮食App启动页
目标：传达健康、新鲜、简洁的品牌形象
规格：9:16竖版，适合手机屏幕
色调：清新自然，绿色为主
元素：新鲜食材，但不要过于写实
```

**Prompt 开发过程**

*Version 1（初稿）：*

```json
{
  "prompt": "Fresh vegetables and fruits, healthy eating concept, 
  clean background, mobile app style",
  "config": {
    "aspectRatio": "9:16",
    "numberOfImages": 4
  }
}
```

**问题：** 太写实，像照片；缺少设计感

*Version 2（调整风格）：*

```json
{
  "prompt": "Fresh vegetables and fruits floating composition, healthy 
  eating concept, clean gradient background from white to light green, 
  minimalist illustration style, modern mobile app aesthetic, soft shadows",
  "config": {
    "aspectRatio": "9:16",
    "numberOfImages": 4
  },
  "negativePrompt": "photorealistic, dark, cluttered, realistic photography"
}
```

**问题：** 还是有点复杂，不够简洁

*Version 3（最终版）：*

```json
{
  "prompt": "Minimalist illustration of fresh vegetables and fruits 
  (tomato, avocado, leafy greens) floating in clean composition, 
  vertical mobile app splash screen, soft gradient background from 
  white to sage green, flat design style with subtle shadows, modern 
  healthy lifestyle aesthetic, generous white space at top and bottom 
  for logo and text, professional app design quality",
  "config": {
    "aspectRatio": "9:16",
    "numberOfImages": 4,
    "outputMimeType": "image/png"
  },
  "negativePrompt": "photorealistic, dark background, cluttered, 
  complex details, realistic textures, 3D render, busy composition, 
  people, hands"
}
```

**结果：** ✅ 符合要求，清新简洁，适合App使用

**关键要点总结：**

- 明确指定 "vertical mobile app splash screen" 确保适配场景
- "generous white space at top and bottom" 为Logo和文字预留空间
- 使用 "flat design style" 确保现代简洁感
- Negative 中排除写实风格和复杂元素

---

#### 🏢 案例B：企业年度报告封面

**需求分析**

```
项目：科技公司2026年度报告封面
目标：展现创新、增长、未来感
规格：A4竖版（3:4比例）
色调：企业蓝为主，点缀科技感的青色
元素：抽象数据可视化，但不要太具象
```

**最终 Prompt**

```json
{
  "prompt": "Abstract corporate annual report cover design, flowing data 
  visualization elements, ascending lines and geometric shapes representing 
  growth, deep blue gradient background with cyan accents, modern minimalist 
  business aesthetic, professional and sophisticated, futuristic feel, 
  clean composition with space for title text at top third, digital art 
  style, high-end corporate publication quality, sense of innovation and 
  progress, 3:4 portrait format",
  "config": {
    "aspectRatio": "3:4",
    "numberOfImages": 4,
    "outputMimeType": "image/jpeg",
    "outputCompressionQuality": 95
  },
  "negativePrompt": "photorealistic, people, faces, specific products, 
  literal imagery, childish, cartoon, overly complex,
```

```json
"negativePrompt": "photorealistic, people, faces, specific products, 
  literal imagery, childish, cartoon, overly complex, cluttered, 
  text visible, logo, bright colors, warm tones, messy, chaotic"
}
```

**设计决策说明：**

- "ascending lines and geometric shapes" 隐喻业务增长
- "space for title text at top third" 为封面标题预留空间
- "deep blue gradient with cyan accents" 精确控制色彩
- Negative 排除人物和具体产品，保持抽象专业感

---

#### 🎉 案例C：社交媒体营销素材矩阵

**需求分析**

```
项目：咖啡品牌Instagram内容日历（一周7张）
目标：建立一致的视觉风格，提升品牌识别度
规格：1:1方形，适合Instagram Feed
主题：温暖、手工、生活方式
```

**统一基础模板**

```
固定元素：
- 风格："warm lifestyle photography, cozy atmosphere"
- 色调："warm brown tones, cream and beige palette"
- 光照："soft natural window light, golden hour feel"
- 质量："professional food photography, editorial quality"

固定 Negative：
"harsh lighting, cold tones, artificial, overly staged, dark, cluttered"

固定 Config：
{
  "aspectRatio": "1:1",
  "numberOfImages": 4,
  "outputMimeType": "image/jpeg"
}
```

**7天内容 Prompts**

*周一 - 产品特写*

```
"Close-up of steaming coffee cup on rustic wooden table, morning sunlight, 
warm lifestyle photography, cozy atmosphere, latte art visible, soft natural 
window light from left, warm brown tones and cream palette, shallow depth 
of field, professional food photography, editorial quality, inviting and 
comforting mood"
```

*周二 - 环境氛围*

```
"Cozy coffee shop corner with armchair and small table, book and coffee cup, 
warm lifestyle photography, soft natural window light, warm brown and beige 
palette, plants in background softly blurred, inviting atmosphere, professional 
interior photography, editorial quality, peaceful morning vibe"
```

*周三 - 制作过程*

```
"Barista hands pouring latte art, mid-pour action shot, warm lifestyle 
photography, cozy coffee shop background blurred, soft natural light, warm 
brown tones, professional food photography, editorial quality, artisan 
craftsmanship feel, authentic moment"
```

*周四 - 产品组合*

```
"Flat lay of coffee brewing equipment and beans on marble surface, organized 
composition, warm lifestyle photography, soft overhead natural light, warm 
brown and cream palette, minimalist aesthetic, professional product photography, 
editorial quality, artisanal coffee culture"
```

*周五 - 社交场景*

```
"Two hands holding coffee cups in a toast gesture, cozy cafe background, warm 
lifestyle photography, friendly gathering atmosphere, soft natural light, warm 
tones, professional photography, editorial quality, connection and community feel"
```

*周六 - 细节特写*

```
"Coffee beans scattered artfully on burlap fabric, macro photography, warm 
lifestyle aesthetic, soft natural light creating texture, warm brown tones, 
professional food photography, editorial quality, artisan and authentic feel"
```

*周日 - 生活方式*

```
"Relaxing Sunday morning scene, coffee on bed with book and cozy blanket, warm 
lifestyle photography, soft natural morning light from window, warm beige and 
cream palette, peaceful atmosphere, professional lifestyle photography, editorial 
quality, self-care and comfort mood"
```

**一致性维护要点：**

- 所有 Prompt 都包含 "warm lifestyle photography"
- 统一的色调描述 "warm brown tones, cream and beige palette"
- 光照保持 "soft natural light"
- 质量标准 "professional + editorial quality"

---

### 8.2 行业特定案例

#### 🏥 医疗健康行业

```json
{
  "prompt": "Modern hospital consultation room, doctor and patient discussing 
  at desk with medical charts, bright clean environment, natural daylight from 
  large windows, professional medical photography, reassuring and trustworthy 
  atmosphere, soft color palette with white and light blue, contemporary 
  healthcare facility, wide angle interior shot, high-end medical editorial quality",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4,
    "personGeneration": "allow_adult",
    "safetyFilterLevel": "block_medium_and_above"
  },
  "negativePrompt": "dark, scary, clinical coldness, medical procedures visible, 
  blood, needles, sick patients, cluttered, outdated equipment"
}
```

#### 🎓 教育培训行业

```json
{
  "prompt": "Bright modern classroom with students engaged in collaborative 
  learning, diverse group working on laptops and tablets, natural daylight 
  from windows, contemporary educational environment, warm and welcoming 
  atmosphere, colorful but professional, wide shot showing space, educational 
  photography, inspiring learning environment, technology-integrated education",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4,
    "personGeneration": "allow_adult"
  },
  "negativePrompt": "traditional old classroom, boring, rows of desks, dark, 
  empty, too formal, sterile"
}
```

#### 🏠 房地产建筑

```json
{
  "prompt": "Luxury modern living room interior, floor-to-ceiling windows with 
  city view, contemporary furniture with neutral tones, afternoon golden light, 
  architectural photography, spacious and elegant, high-end residential design, 
  clean lines and minimalist aesthetic, professional real estate photography, 
  aspirational lifestyle, 8K quality",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4,
    "outputCompressionQuality": 95
  },
  "negativePrompt": "cluttered, dark, small space, outdated design, messy, 
  personal items visible, cheap furniture, poor lighting"
}
```

#### 🍽️ 餐饮美食

```json
{
  "prompt": "Gourmet dish plated elegantly on white ceramic, colorful fresh 
  ingredients artfully arranged, restaurant quality presentation, soft natural 
  light from window creating gentle shadows, shallow depth of field with 
  blurred background, professional food photography, Michelin-star aesthetic, 
  vibrant colors, appetizing and luxurious, editorial food magazine quality",
  "config": {
    "aspectRatio": "1:1",
    "numberOfImages": 4,
    "outputMimeType": "image/jpeg",
    "outputCompressionQuality": 90
  },
  "negativePrompt": "messy, unappetizing, dark, overcooked, fast food, 
  cheap presentation, cluttered background, artificial lighting, too busy"
}
```

#### 💪 健身运动

```json
{
  "prompt": "Athletic person in workout gear doing yoga pose in modern gym, 
  large windows with natural light, motivational and energetic atmosphere, 
  fitness lifestyle photography, dynamic composition, clean and spacious 
  environment, professional sports photography, inspiring and aspirational, 
  healthy lifestyle aesthetic, vibrant but natural colors",
  "config": {
    "aspectRatio": "4:3",
    "numberOfImages": 4,
    "personGeneration": "allow_adult"
  },
  "negativePrompt": "dark gym, crowded, messy, unflattering angle, 
  exhausted expression, cluttered equipment, artificial atmosphere"
}
```

#### 🌿 可持续环保

```json
{
  "prompt": "Hands holding young plant seedling with soil, soft natural light, 
  blurred green nature background, environmental conservation concept, close-up 
  lifestyle photography, hopeful and nurturing mood, earth tones with vibrant 
  green, professional editorial photography, growth and sustainability theme, 
  authentic and organic feel",
  "config": {
    "aspectRatio": "3:4",
    "numberOfImages": 4,
    "personGeneration": "allow_adult"
  },
  "negativePrompt": "artificial, plastic, pollution visible, dark, 
  industrial, manufactured, fake plants, sterile"
}
```

---

### 8.3 创意探索案例

#### 🎨 风格融合实验

**实验1：赛博朋克 × 中国传统**

```json
{
  "prompt": "Traditional Chinese courtyard architecture merged with cyberpunk 
  aesthetics, neon lights integrated into ancient wooden structures, holographic 
  projections of dragons, rain-slicked stone ground reflecting pink and cyan 
  neon, misty atmosphere, cinematic sci-fi concept art, East meets future, 
  detailed digital painting, dramatic lighting contrast, Blade Runner meets 
  Chinese heritage, 8K quality",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4
  },
  "negativePrompt": "modern buildings, cars, purely Western, bright daylight, 
  flat lighting, simplistic"
}
```

**实验2：自然元素拟人化**

```json
{
  "prompt": "Abstract representation of ocean waves as a flowing female figure, 
  water transforming into elegant dress, deep blue and turquoise colors with 
  white foam accents, surreal art style, graceful movement, fantasy illustration, 
  ethereal and magical atmosphere, digital art, artistic interpretation of 
  nature's beauty, dreamlike quality",
  "config": {
    "aspectRatio": "3:4",
    "numberOfImages": 4
  },
  "negativePrompt": "realistic human, photographic, literal, simple, 
  cartoonish, childish"
}
```

**实验3：微观世界宏观化**

```json
{
  "prompt": "Microscopic view of crystal formations magnified to look like 
  alien landscape, iridescent colors, geometric patterns, macro photography 
  meets sci-fi concept art, otherworldly terrain, dramatic lighting creating 
  deep shadows and bright highlights, abstract natural beauty, scientific 
  photography aesthetic, stunning details, 8K ultra HD",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4
  },
  "negativePrompt": "recognizable objects, people, animals, man-made 
  structures, text, labels"
}
```

---

## 9. 高级专题

### 9.1 色彩心理学应用

#### 🎨 色彩情绪对照表

```yaml
红色系 (Red/Crimson/Scarlet):
  情绪: 激情、能量、紧迫、危险
  适用: 促销、警示、运动品牌
  Prompt词: "vibrant red, energetic crimson, bold scarlet tones"
  
蓝色系 (Blue/Navy/Teal):
  情绪: 信任、专业、平静、科技
  适用: 企业、医疗、金融、科技
  Prompt词: "trustworthy deep blue, professional navy, modern teal accents"
  
绿色系 (Green/Sage/Emerald):
  情绪: 自然、健康、成长、平衡
  适用: 环保、健康、有机产品
  Prompt词: "natural green, calming sage, vibrant emerald tones"
  
黄色系 (Yellow/Gold/Amber):
  情绪: 乐观、温暖、活力、注意
  适用: 儿童、食品、警示
  Prompt词: "cheerful yellow, warm golden, rich amber tones"
  
紫色系 (Purple/Lavender/Violet):
  情绪: 奢华、创意、神秘、精神
  适用: 美容、奢侈品、创意行业
  Prompt词: "luxurious purple, soft lavender, deep violet tones"
 
橙色系 (Orange/Coral/Peach):
  情绪: 友好、活力、创造力、温暖
  适用: 社交、娱乐、创意产业
  Prompt词: "friendly orange, vibrant coral, soft peach tones"

粉色系 (Pink/Rose/Blush):
  情绪: 浪漫、温柔、关怀、年轻
  适用: 美容、婚礼、女性产品
  Prompt词: "romantic pink, elegant rose, delicate blush tones"

棕色系 (Brown/Tan/Beige):
  情绪: 稳定、可靠、自然、温暖
  适用: 手工、咖啡、自然产品
  Prompt词: "warm brown, natural tan, neutral beige tones"

黑白灰系 (Monochrome):
  情绪: 经典、精致、现代、简约
  适用: 奢侈品、建筑、时尚
  Prompt词: "monochrome palette, elegant black and white, sophisticated grayscale"
```

#### 🌈 色彩组合公式

```
互补色对比（高冲击力）：
"blue and orange color scheme, high contrast, vibrant"
"purple and yellow palette, bold complementary colors"

类似色和谐（柔和统一）：
"analogous blue to green gradient, harmonious palette"
"warm orange to red spectrum, cohesive color story"

三色平衡（动态均衡）：
"triadic color scheme with red, yellow and blue accents"
"balanced palette of purple, orange and green"

单色变化（优雅简约）：
"monochromatic blue palette from navy to light cyan"
"tonal green variations, sophisticated single-hue scheme"

中性+强调色（专业突出）：
"neutral gray background with vibrant coral accent"
"beige and cream base with bold teal highlights"
```

### 9.2 季节性与时令主题

#### 🌸 春季 (Spring)

```json
{
  "prompt": "Fresh spring morning scene with blooming cherry blossoms, 
  soft pastel colors of pink and light green, gentle morning mist, 
  new growth and renewal theme, delicate flowers and young leaves, 
  soft diffused natural light, optimistic and fresh atmosphere, 
  pastel color palette, spring aesthetic, nature photography, 
  hope and new beginnings mood",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4
  },
  "negativePrompt": "autumn colors, dark, winter, dead leaves, 
  harsh lighting, saturated colors"
}
```

#### ☀️ 夏季 (Summer)

```json
{
  "prompt": "Vibrant summer beach scene at golden hour, turquoise ocean 
  waves, warm sand, bright sunny day, tropical paradise atmosphere, 
  saturated vivid colors with blues and golds, energetic and joyful mood, 
  vacation lifestyle photography, clear blue sky, dynamic and lively, 
  professional travel photography, summery feel",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4
  },
  "negativePrompt": "cold, gray, cloudy, winter, muted colors, 
  gloomy, indoor"
}
```

#### 🍂 秋季 (Autumn)

```json
{
  "prompt": "Cozy autumn scene with falling leaves, warm color palette 
  of orange, red and golden yellow, soft afternoon light filtering through 
  trees, nostalgic and contemplative mood, rustic and natural aesthetic, 
  harvest season atmosphere, rich warm tones, comfortable and inviting, 
  seasonal lifestyle photography, fall foliage beauty",
  "config": {
    "aspectRatio": "4:3",
    "numberOfImages": 4
  },
  "negativePrompt": "spring flowers, bright green, summer, cold colors, 
  harsh light, modern urban"
}
```

#### ❄️ 冬季 (Winter)

```json
{
  "prompt": "Serene winter landscape with fresh snow, minimalist white 
  and blue color palette, soft overcast light, peaceful and quiet atmosphere, 
  frost-covered trees, clean and crisp aesthetic, cool tones with subtle 
  warmth from distant light, contemplative mood, winter wonderland, 
  professional nature photography, calm and tranquil",
  "config": {
    "aspectRatio": "16:9",
    "numberOfImages": 4
  },
  "negativePrompt": "warm colors, flowers, green leaves, summer, 
  tropical, bright sunny"
}
```

### 9.3 文化节日主题

#### 🎄 圣诞节 (Christmas)

```
核心元素: Christmas tree, ornaments, warm lights, gifts, snow
色彩方案: "red and green with gold accents, warm festive colors"
氛围: "cozy, magical, family-oriented, joyful celebration"
光照: "warm twinkle lights, soft candlelight, golden glow"

示例 Prompt:
"Cozy Christmas living room with decorated tree, warm fairy lights, 
presents underneath, fireplace glowing, red and green color scheme 
with gold accents, magical holiday atmosphere, soft warm lighting, 
inviting and festive, professional holiday photography, family celebration feel"
```

#### 🎊 新年 (New Year)

```
核心元素: fireworks, champagne, celebration, countdown, sparkle
色彩方案: "gold, silver and black, glamorous metallic tones"
氛围: "excitement, new beginnings, optimism, elegance"
光照: "sparkling lights, dramatic backlighting, celebratory glow"

示例 Prompt:
"Elegant New Year celebration scene with champagne glasses, gold and 
black color scheme, sparkles and confetti, midnight celebration atmosphere, 
glamorous and sophisticated, dramatic lighting with bokeh effects, 
optimistic new beginnings mood, high-end event photography"
```

#### 🏮 春节/农历新年 (Chinese New Year)

```
核心元素: red lanterns, gold decorations, traditional patterns, dragons
色彩方案: "vibrant red and gold, auspicious traditional colors"
氛围: "prosperity, family reunion, festive, traditional"
光照: "warm glowing lanterns, festive bright lighting"

示例 Prompt:
"Traditional Chinese New Year decoration scene with red lanterns and 
gold ornaments, vibrant red and gold color scheme, auspicious patterns 
and symbols, festive celebration atmosphere, warm glowing lights, 
cultural heritage aesthetic, prosperity and happiness theme, 
professional cultural photography"
```

#### 🎃 万圣节 (Halloween)

```
核心元素: pumpkins, autumn colors, mysterious atmosphere, playful spooky
色彩方案: "orange, black and purple, autumn night palette"
氛围: "mysterious, playful, slightly eerie but fun"
光照: "dramatic shadows, candlelit glow, moonlight"

示例 Prompt:
"Atmospheric Halloween scene with carved pumpkins glowing, autumn leaves, 
orange and purple color scheme against dark background, mysterious but 
playful mood, dramatic candlelight creating shadows, festive decoration, 
not scary, family-friendly Halloween aesthetic, creative seasonal photography"
```

### 9.4 情感驱动的 Prompt 设计

#### 😊 积极情绪表达

**快乐/喜悦 (Joy/Happiness)**

```
关键词组合:
- "bright, cheerful, vibrant, uplifting, joyful atmosphere"
- "smiling, laughing, celebrating, energetic"
- "sunny, colorful, light-filled, positive energy"

完整示例:
"Joyful celebration moment with people laughing together, bright vibrant 
colors, energetic atmosphere, natural sunlight creating uplifting mood, 
candid happiness, warm and cheerful, professional lifestyle photography, 
genuine smiles and positive energy, authentic moment of joy"
```

**平静/宁静 (Peace/Serenity)**

```
关键词组合:
- "calm, peaceful, serene, tranquil, meditative"
- "soft, gentle, soothing, quiet, still"
- "harmonious, balanced, zen-like, restful"

完整示例:
"Serene zen garden scene, calm water reflection, minimalist composition, 
soft muted colors in greens and grays, peaceful atmosphere, gentle natural 
light, meditative and tranquil mood, balanced harmony, quiet contemplation, 
professional mindfulness photography, restful and soothing"
```

**浪漫/温柔 (Romance/Tenderness)**

```
关键词组合:
- "romantic, tender, intimate, gentle, affectionate"
- "soft focus, dreamy, warm tones, delicate"
- "loving, caring, emotional connection, heartfelt"

完整示例:
"Romantic couple moment at sunset, soft warm golden light, tender embrace, 
dreamy atmosphere with soft focus background, gentle pink and orange tones, 
intimate and affectionate mood, emotional connection visible, delicate and 
beautiful, professional wedding photography style, heartfelt and genuine"
```

#### 🎭 专业情绪表达

**专业/权威 (Professional/Authority)**

```
关键词组合:
- "professional, authoritative, confident, competent, executive"
- "clean, sharp, polished, sophisticated, business"
- "trustworthy, reliable, established, expert"

完整示例:
"Professional business executive in modern office, confident posture, 
sophisticated business attire, clean sharp lighting, authoritative presence, 
polished and competent appearance, trustworthy demeanor, contemporary 
corporate environment, high-end business photography, expert and established feel"
```

**创新/前瞻 (Innovation/Forward-thinking)**

```
关键词组合:
- "innovative, futuristic, cutting-edge, progressive, visionary"
- "dynamic, bold, transformative, pioneering"
- "technology-driven, modern, next-generation, revolutionary"

完整示例:
"Futuristic innovation concept with abstract technology elements, cutting-edge 
design, bold dynamic composition, modern metallic and neon colors, progressive 
and visionary atmosphere, transformative energy, sleek contemporary aesthetic, 
high-tech visualization, pioneering spirit, next-generation feel"
```

**信任/可靠 (Trust/Reliability)**

```
关键词组合:
- "trustworthy, reliable, dependable, secure, stable"
- "honest, transparent, authentic, genuine"
- "reassuring, comforting, safe, professional"

完整示例:
"Healthcare professional consulting with patient, trustworthy and caring 
demeanor, clean professional environment, natural reassuring lighting, 
dependable and competent presence, genuine human connection, safe and 
comfortable atmosphere, authentic interaction, medical editorial photography, 
reliable healthcare provider image"
```

### 9.5 技术进阶：多阶段生成策略

#### 🔄 三阶段精炼法

**阶段1：概念探索（Concept Exploration）**

```
目的: 快速测试多个方向
策略: 宽泛的描述，让AI提供创意变化
设置: numberOfImages = 4, 简短prompt

示例:
"Modern coffee shop interior, cozy atmosphere, natural light"

评估: 选择最符合方向的1-2张作为基础
```

**阶段2：方向锁定（Direction Refinement）**

```
目的: 在选定方向上增加细节
策略: 保持核心描述，添加具体元素
设置: numberOfImages = 4, 中等详细prompt

示例:
"Modern Scandinavian coffee shop interior with wooden furniture and plants, 
cozy hygge atmosphere, large windows with natural morning light, minimalist 
design, warm neutral tones"

评估: 对比细节表现，找出最佳平衡点
```

**阶段3：完美调优（Perfect Tuning）**

```
目的: 精确控制最终效果
策略: 详细描述+精准negative prompt
设置: numberOfImages = 4, 完整详细prompt

示例:
"Modern Scandinavian coffee shop interior, light oak wooden tables and chairs, 
green potted plants on
```

好的，我继续完成详细的 Skills 文档的剩余部分：

---

示例:
"Modern Scandinavian coffee shop interior, light oak wooden tables and chairs,
green potted plants on shelves, large floor-to-ceiling windows, soft morning
sunlight from left creating gentle shadows, minimalist Nordic design aesthetic,
warm beige and white color palette, cozy hygge atmosphere, professional
architectural photography, clean composition, 8K quality"

Negative: "cluttered, dark, artificial lighting, modern industrial,
colorful decorations, busy patterns, people visible"

评估: 最终输出质量检查

```
#### 🎯 焦点渐进法

**Step 1: 主体确认**
```

只描述主体，忽略背景和细节
"A fluffy orange cat sitting"
→ 确认主体形态正确

```
**Step 2: 环境添加**
```

添加环境背景
"A fluffy orange cat sitting on a wooden chair in a cozy living room"
→ 确认主体与环境关系

```
**Step 3: 氛围营造**
```

添加光照和情绪
"A fluffy orange cat sitting on a wooden chair in a cozy living room,
soft afternoon sunlight, warm and peaceful atmosphere"
→ 确认整体氛围

```
**Step 4: 风格定义**
```

添加风格和质量词
"A fluffy orange cat sitting on a wooden chair in a cozy living room,
soft afternoon sunlight, warm and peaceful atmosphere, lifestyle photography,
professional pet portrait, high quality"
→ 最终风格确认

```
**Step 5: 精细调优**
```

添加所有细节和negative prompt
完整版本 + 详细排除项
→ 完美输出

```
### 9.6 行业专业术语库

#### 📷 摄影专业术语

**曝光控制**
```

- High key: 高调（明亮为主）
- Low key: 低调（暗部为主）
- Exposure compensation: 曝光补偿
- Blown highlights: 过曝高光
- Crushed blacks: 死黑

```
**景深术语**
```

- Bokeh: 焦外散景
- Shallow DOF (f/1.4, f/1.8): 浅景深
- Deep DOF (f/11, f/16): 大景深
- Tack sharp: 极度锐利
- Soft focus: 柔焦

```
**构图术语**
```

- Leading lines: 引导线
- Negative space: 负空间
- Framing: 框架构图
- Symmetry: 对称
- Rule of thirds: 三分法
- Golden spiral: 黄金螺旋
- Diagonal composition: 对角线构图

```
**镜头效果**
```

- Wide angle distortion: 广角畸变
- Telephoto compression: 长焦压缩
- Fisheye effect: 鱼眼效果
- Tilt-shift: 移轴效果
- Lens flare: 镜头光晕

```
#### 🎨 设计术语

**版式设计**
```

- Grid system: 网格系统
- White space/Negative space: 留白
- Visual hierarchy: 视觉层级
- Alignment: 对齐
- Proximity: 亲密性
- Contrast: 对比
- Balance: 平衡

```
**色彩理论**
```

- Color harmony: 色彩和谐
- Hue, Saturation, Value (HSV): 色相、饱和度、明度
- Warm/Cool tones: 暖色调/冷色调
- Color temperature: 色温
- Complementary colors: 互补色
- Analogous colors: 类似色
- Triadic colors: 三色组合

```
**视觉风格**
```

- Flat design: 扁平化设计
- Skeuomorphism: 拟物化
- Material design: 材料设计
- Neumorphism: 新拟态
- Glassmorphism: 玻璃拟态
- Brutalism: 野兽派/粗野主义

```
#### 🎬 电影术语

**镜头运动**
```

- Tracking shot: 跟踪镜头
- Dolly shot: 移动镜头
- Pan: 摇镜
- Tilt: 俯仰
- Crane shot: 升降镜头
- Steadicam: 斯坦尼康稳定器

```
**光照风格**
```

- Rembrandt lighting: 伦勃朗光
- Butterfly lighting: 蝴蝶光
- Split lighting: 分割光
- Rim lighting: 轮廓光
- Practical lighting: 实景光源
- Motivated lighting: 动机光

```
**色彩分级**
```

- Color grading: 调色
- LUT (Look-Up Table): 色彩查找表
- Teal and orange: 青橙色调
- Bleach bypass: 漂白效果
- Cross-processing: 交叉冲印

```
---

## 10. 快速参考卡片

### 10.1 一分钟速查表

#### ⚡ 快速决策树
```

需要生成图片？
│
├─ 是人物吗？
│  ├─ 是 → personGeneration: "allow_adult"
│  │      → aspectRatio: "3:4" 或 "1:1"
│  │      → 注意anatomy相关negative
│  │
│  └─ 否 → personGeneration: "dont_allow"
│
├─ 什么用途？
│  ├─ 社交媒体 → 1:1 或 9:16
│  ├─ 网站Banner → 16:9
│  ├─ 打印/海报 → 3:4 或 4:3
│  └─ 通用 → 1:1
│
├─ 什么风格？
│  ├─ 照片 → "photography, photorealistic"
│  ├─ 插画 → "illustration, digital art"
│  ├─ 艺术 → 具体流派名称
│  └─ 产品 → "product photography, commercial"
│
└─ 需要背景吗？
├─ 需要 → 详细描述环境
├─ 简单背景 → "simple gradient background"
└─ 无背景 → "pure white background" + PNG格式

```
#### 📝 最小可行Prompt模板
```

[主体] + [风格] + [光照] + [质量词]

示例：
"Golden retriever puppy, professional pet photography,
soft natural light, high quality"

可直接使用，30秒完成！

```
#### 🎯 三句话Prompt公式
```

句子1：描述主体是什么
句子2：描述风格和氛围
句子3：描述技术质量

示例：
"A modern minimalist living room with Scandinavian furniture.
Bright and airy atmosphere with natural daylight from large windows.
Professional architectural photography, 8K quality, clean composition."

```
### 10.2 常见错误速查

| ❌ 错误做法 | ✅ 正确做法 | 说明 |
|-----------|-----------|------|
| "a nice picture" | "professional photography, high quality" | 具体化质量描述 |
| "beautiful woman" | "elegant woman with long dark hair, wearing formal dress" | 增加具体特征 |
| "good lighting" | "soft golden hour sunlight from the left" | 精确光照描述 |
| 只描述主体 | 主体+环境+风格+光照 | 完整信息 |
| Prompt超过300词 | 保持50-150词 | 适度详细 |
| 没有negative prompt | 至少包含基础排除词 | 质量保证 |
| numberOfImages=1 | numberOfImages=4 | 提高成功率 |
| 忘记设置personGeneration | 涉及人物必设置 | 避免生成失败 |
| aspectRatio不匹配用途 | 根据使用场景选择 | 实用优先 |
| 风格词冲突 | 统一风格方向 | 保持一致性 |

### 10.3 应急救援指南

#### 🚨 常见问题即时解决

**问题：生成失败/被拦截**
```

立即尝试：

1. 降低safetyFilterLevel到"block_only_high"
2. 检查是否有敏感词汇，改为委婉表达
3. 如有人物，确认personGeneration已设置
4. 简化prompt，去除可能引起误解的描述

```
**问题：风格完全不对**
```

立即尝试：

1. 在prompt开头明确风格："professional photography style"
2. negative中排除冲突风格："cartoon, illustration, 3D render"
3. 添加参考："cinematic lighting, movie still quality"
4. 增加风格相关质量词

```
**问题：主体错误或缺失**
```

立即尝试：

1. 将主体描述移到prompt最前面
2. 增加主体的具体特征描述
3. 在negative中排除不想要的主体
4. 简化背景描述，突出主体

```
**问题：构图或比例问题**
```

立即尝试：

1. 更改aspectRatio适配主体
2. 添加构图描述："centered composition" "rule of thirds"
3. 明确景别："close-up" "full body" "wide shot"
4. 添加negative："cropped, cut off, edges trimmed"

```
**问题：颜色不理想**
```

立即尝试：

1. 使用具体色彩名称："teal blue" "coral pink"
2. 添加色调描述："warm tones" "cool palette" "vibrant colors"
3. Negative排除不想要的色调："desaturated, monochrome"
4. 参考色彩搭配："analogous blue to green palette"

```
---

## 11. 最佳实践工作流

### 11.1 专业工作流程

#### 📋 项目启动清单
```

□ Step 1: 明确需求

- 用途：社交/网站/印刷/演示？
- 尺寸：根据用途确定aspectRatio
- 数量：需要几张变体？
- 风格：摄影/插画/艺术？
- 情绪：传达什么感觉？

□ Step 2: 收集参考

- 找3-5张风格参考图
- 提取关键视觉元素
- 记录喜欢的特点
- 列出不想要的元素

□ Step 3: 编写初版Prompt

- 使用7要素公式
- 50-150词长度
- 包含风格和质量词
- 准备基础negative

□ Step 4: 首次生成

- numberOfImages = 4
- 标准config设置
- 观察整体方向

□ Step 5: 迭代优化

- 分析问题所在
- 针对性调整prompt
- 更新negative prompt
- 再次生成对比

□ Step 6: 最终确认

- 检查技术质量
- 确认符合需求
- 必要时微调
- 导出最终文件

```
#### 🔧 Prompt编写工作流
```

1. 脑暴阶段（5分钟）
   
   - 列出所有关键元素
   - 确定核心主题
   - 想象最终画面
2. 结构搭建（5分钟）
   
   - 套用7要素公式
   - 主体 → 环境 → 风格 → 光照
   - 保持逻辑顺序
3. 细节填充（10分钟）
   
   - 为每个要素添加形容词
   - 增加具体描述
   - 控制总长度
4. Negative准备（5分钟）
   
   - 基础质量排除词
   - 场景特定排除
   - 风格冲突排除
5. Config配置（2分钟）
   
   - 选择aspectRatio
   - 设置numberOfImages
   - 其他参数确认
6. 首次测试（生成）
   
   - 提交生成
   - 等待结果
7. 评估分析（5分钟）
   
   - 对比4张结果
   - 记录问题点
   - 确定优化方向
8. 迭代优化（循环）
   
   - 修改prompt
   - 更新negative
   - 再次生成
   - 直到满意

```

```

### 11.2 团队协作规范

#### 👥 Prompt资产管理

```yaml
文件命名规范:
  格式: "[项目名]_[场景类型]_[风格]_v[版本号].json"
  示例: "CoffeeBrand_Product_Lifestyle_v3.json"

版本控制:
  v1: 初版探索
  v2: 方向确定后的优化
  v3+: 细节调整版本
  
文档结构:
  {
    "project": "项目名称",
    "scene_type": "场景类型",
    "purpose": "使用目的",
    "prompt": "完整prompt内容",
    "negative_prompt": "negative内容",
    "config": {
      "aspectRatio": "1:1",
      "numberOfImages": 4,
      ...
    },
    "notes": "备注说明",
    "created_by": "创建者",
    "date": "2026-02-10",
    "tags": ["标签1", "标签2"]
  }

分类标签体系:
  - 行业: tech/retail/food/healthcare/education
  - 用途: social/web/print/presentation
  - 风格: photo/illustration/abstract/concept
  - 情绪: professional/casual/energetic/calm
```

#### 📊 质量评估标准

```
评分维度（1-5分）:

1. 主题准确性
   5分: 完全符合需求，主体清晰准确
   3分: 基本符合，有小偏差
   1分: 主体错误或缺失

2. 技术质量
   5分: 清晰锐利，无瑕疵
   3分: 可接受，有轻微问题
   1分: 模糊、畸形、严重缺陷

3. 美学价值
   5分: 构图优美，视觉冲击力强
   3分: 中规中矩，无明显问题
   1分: 构图失败，不美观

4. 风格一致性
   5分: 完美符合指定风格
   3分: 基本符合，略有偏差
   1分: 风格完全不对

5. 可用性
   5分: 可直接使用，无需修改
   3分: 需要轻微调整
   1分: 无法使用，需要重新生成

合格标准: 总分 ≥ 18/25
优秀标准: 总分 ≥ 22/25
```

### 11.3 效率提升技巧

#### ⚡ 批量生成策略

**场景1：需要同一主题的多种变体**

```
策略：固定核心prompt，变化单一变量

基础模板:
"[固定的主体和环境描述], [可变元素], [固定的风格和质量]"

示例批次：
变体A: "...morning sunlight..."
变体B: "...afternoon golden hour..."
变体C: "...evening blue hour..."
变体D: "...overcast soft light..."

一次性提交4个请求，高效获得光照变体
```

**场景2：需要不同场景的系列内容**

```
策略：模板化固定元素，替换场景

固定元素:
- 风格: "warm lifestyle photography"
- 色调: "cozy autumn tones"
- 质量: "professional editorial quality"
- Negative: "cluttered, dark, artificial"

场景变化:
- 场景1: 室内咖啡场景
- 场景2: 户外公园场景
- 场景3: 工作空间场景
- 场景4: 阅读休闲场景

保持视觉一致性的系列内容
```

#### 🎯 模板库建设

**个人模板库结构**

```
我的Prompt模板/
├── 人像摄影/
│   ├── 商务肖像.json
│   ├── 生活方式.json
│   └── 时尚编辑.json
├── 产品摄影/
│   ├── 白底电商.json
│   ├── 场景展示.json
│   └── 高端奢侈品.json
├── 场景环境/
│   ├── 室内空间.json
│   ├── 自然风景.json
│   └── 城市街景.json
├── 插画设计/
│   ├── 扁平风格.json
│   ├── 水彩风格.json
│   └── 概念艺术.json
└── 行业定制/
    ├── 医疗健康.json
    ├── 教育培训.json
    └── 科技互联网.json
```

**模板使用流程**

```
1. 根据需求选择最接近的模板
2. 复制模板内容
3. 替换可变部分（主体、颜色、具体细节）
4. 保持固定部分（风格、质量词、negative）
5. 快速生成，节省80%时间
```

---

## 12. 附录

### 12.1 专业词汇中英对照

#### 摄影相关

```
景深 - Depth of Field (DOF)
散景 - Bokeh
曝光 - Exposure
光圈 - Aperture
快门 - Shutter Speed
感光度 - ISO
白平衡 - White Balance
构图 - Composition
焦距 - Focal Length
对焦 - Focus
测光 - Metering
色温 - Color Temperature
动态范围 - Dynamic Range
颗粒感 - Grain
色差 - Chromatic Aberration
暗角 - Vignetting
```

#### 设计相关

```
版式 - Layout
网格 - Grid
对齐 - Alignment
间距 - Spacing
层级 - Hierarchy
平衡 - Balance
对比 - Contrast
重复 - Repetition
亲密性 - Proximity
留白 - White Space / Negative Space
色相 - Hue
饱和度 - Saturation
明度 - Brightness / Value
透明度 - Opacity
渐变 - Gradient
```

#### 艺术风格

```
写实主义 - Realism
印象派 - Impressionism
表现主义 - Expressionism
立体主义 - Cubism
超现实主义 - Surrealism
抽象主义 - Abstract
极简主义 - Minimalism
波普艺术 - Pop Art
装饰艺术 - Art Deco
新艺术运动 - Art Nouveau
```

### 12.2 Prompt公式速记卡

#### 📇 万能公式卡片

**基础公式**

```
主体 + 动作 + 环境 + 风格 + 光照 + 视角 + 质量
```

**摄影公式**

```
[拍摄对象] + [姿态/表情] + [服装/道具] + 
photography style + [光照方式] + [镜头视角] + 
professional quality
```

**插画公式**

```
[主题内容] + illustration style + [艺术流派] + 
[色彩方案] + [构图方式] + [情绪氛围] + 
editorial quality
```

**产品公式**

```
[产品名称] + [材质] + [角度] + [背景] + 
product photography + [光照设置] + 
commercial quality
```

**场景公式**

```
[场景类型] + [时间] + [天气] + [主要元素] + 
[风格] + [色调] + cinematic + 
professional quality
```

### 12.3 应急Prompt生成器

#### 🆘 30秒快速生成

**步骤1：填空（10秒）**

```
我要生成：____________（主体）
用于：____________（用途）
风格：____________（摄影/插画/艺术）
```

**步骤2：自动组装（10秒）**

```python
prompt = f"{主体}, {风格} style, professional quality, 
          high resolution, {根据用途添加氛围词}"

config = {
  "aspectRatio": "根据用途选择",
  "numberOfImages": 4
}

negative = "blurry, low quality, bad anatomy, watermark"
```

**步骤3：发送生成（10秒）**

#### 示例应用

**输入：**

```
主体：咖啡杯
用途：Instagram帖子
风格：摄影
```

**输出：**

```json
{
  "prompt": "Coffee cup on wooden table, lifestyle photography style, 
  warm cozy atmosphere, soft natural light, professional quality, 
  high resolution, Instagram-worthy aesthetic",
  "config": {
    "aspectRatio": "1:1",
    "numberOfImages": 4
  },
  "negativePrompt": "blurry, low quality, watermark, dark, cluttered"
}
```

### 12.4 学习路径建议

#### 🎓 初级阶段（第1-2周）

**学习目标：**

- 掌握基本参数设置
- 能写出50-100词的基础prompt
- 理解aspectRatio的选择逻辑

**练习任务：**

1. 生成10张不同主题的简单图片
2. 每张尝试3个不同的aspectRatio
3. 记录哪些描述词有效

**必学内容：**

- 7要素公式
- 基础negative prompt
- 常用风格关键词

#### 🎓 中级阶段（第3-4周）

**学习目标：**

- 能针对具体场景优化prompt
- 掌握风格一致性控制
- 学会迭代优化流程

**练习任务：**

1. 完成一个5张系列图片项目
2. 对同一主题生成3个版本对比
3. 建立个人常用模板库

**必学内容：**

- 场景化模板应用
- Negative prompt精准控制
- 色彩情绪运用

#### 🎓 高级阶段（第5-8周）

**学习目标：**

- 能处理复杂创意需求
- 掌握风格融合技巧
- 建立系统化工作流

**练习任务：**

1. 完成一个完整的品牌视觉系统
2. 尝试3种以上风格融合
3. 优化个人效率工作流

**必学内容：**

- 高级优化策略
- 多阶段生成技巧
- 团队协作规范

---

## 📌 总结与核心要点

### ✨ 黄金法则

1. **具体 > 模糊**：用"fluffy orange tabby cat"而非"cat"
2. **结构化描述**：遵循7要素公式
3. **主体优先**：最重要的内容放在prompt前部
4. **风格明确**：清楚说明是摄影还是插画
5. **光照细节**：描述光源、方向、强度
6. **质量保证**：添加"professional, high quality, 8K"等词
7. **排除明确**：用negative prompt排除不想要的元素
8. **迭代优化**：很少一次完美，准备好调整2-3次
9. **批量测试**：numberOfImages设为4提高选择空间
10. **记录成功**：保存好用的prompt建立个人库

### 🎯 核心公式回顾

**万能7要素公式：**

```
[主体描述] + [动作/状态] + [环境/场景] + [风格流派] + 
[光照描述] + [视角/构图] + [质量增强词]
```

**Config核心参数：**

```json
{
  "aspectRatio": "根据用途选择 1:1/3:4/4:3/9:16/16:9",
  "numberOfImages": "建议设为4",
  "personGeneration": "有人物时必设置",
  "safetyFilterLevel": "推荐 block_medium_and_above",
  "outputMimeType": "需要透明背景用PNG，否则JPEG"
}
```

**Negative Prompt基础模板：**

```
blurry, low quality, distorted, bad anatomy, watermark, text, 
[场景特定排除], [风格冲突排除]
```

### 🚀 快速上手流程

**5分钟生成流程：**

```
1分钟：明确需求（用途、风格、情绪）
1分钟：套用模板或公式写prompt
1分钟：配置参数和negative
1分钟：生成并等待结果
1分钟：评估并决定是否需要迭代
```

### 📚 进阶学习资源

**建议实践顺序：**

1. 从简单产品图开始（白底商品）
2. 进阶到场景摄影（生活方式图）
3. 尝试人物肖像（注意anatomy）
4. 探索插画风格（扁平、水彩等）
5. 挑战复杂概念艺术（风格融合）

**持续提升建议：**

- 每周练习至少10次生成
- 收集喜欢的图片分析其特点
- 建立个人Prompt词库
- 记录失败案例和解决方案
- 参考优秀摄影和设计作品

### 🎁 额外提示

**时间节省技巧：**

- 为常见需求准备5-10个模板
- 使用版本控制避免重复劳动
- 批量处理相似任务
- 善用numberOfImages=4一次获得变体

**质量提升技巧：**

- 第一次生成作为方向测试
- 至少迭代2次追求完美
- 对比多个版本选最佳
- 学习顶级摄影师和设计师的作品

**成本控制技巧：**

- 测试阶段用简短prompt
- 确定方向后再详细描述
- 避免无意义的重复生成
- 记录成功案例复用

---

## 🎉 结语

这份Skills手册涵盖了从基础到高级的完整知识体系：

✅ **完整参数解析**：所有配置项的详细说明和使用场景
✅ **Prompt工程**：7要素公式和场景化模板
✅ **风格词典**：300+专业术语和风格描述
✅ **实战案例**：20+不同行业和场景的完整案例
✅ **问题排查**：常见问题的系统化解决方案
✅ **工作流程**：专业团队协作规范
✅ **效率工具**：快速生成和批量处理策略

### 📖 如何使用这份手册

**新手入门：**
从"2. Prompt工程完整指南"开始，学习基础公式，然后参考"4. 场景化模板"快速上手。

**有经验者：**
直接跳到"8. 实战案例库"找到相似场景，或查阅"3. 风格词典库"丰富描述词汇。

**遇到问题：**
查看"7. 故障排除指南"找到对应问题的解决方案。

**日常使用：**
参考"10. 快速参考卡片"的速查表和公式卡，保存常用的场景模板。

**团队协作：**
遵循"11.2 团队协作规范"建立统一的Prompt管理体系。

### 🔄 持续更新

随着Imagen模型的更新和你使用经验的积累：

- 记录新发现的有效技巧
- 补充行业特定案例
- 优化你的个人模板库
- 分享成功经验给团队

### 💡 最后的建议

**记住：**

- 好的图片生成80%靠prompt，20%靠运气
- 没有完美的第一次，迭代是常态
- 建立自己的风格和模板库
- 学习优秀作品的描述方式
- 实践是最好的老师

**开始行动：**
现在就选择一个场景，套用本手册的模板，生成你的第一张（或下一张）专业级图片！

---

**文档信息**

- **版本**：v1.0 Complete Edition
- **适用模型**：Imagen 3.0 (imagen-3.0-generate-001)
- **文档长度**：约15,000字完整指南
- **创建日期**：2026年2月10日
- **作者**：Bruce Tien 专属定制

**快速联系**
如需补充特定行业或场景的模板，随时可以：

- 添加新的场景化案例
- 扩展特定领域词汇库
- 优化现有模板
- 创建行业定制版本

---

## 🎯 立即开始

选择一个起点：

**选项A - 我是新手**
→ 前往"2.1 黄金公式"学习基础结构
→ 使用"10.3 应急Prompt生成器"快速上手

**选项B - 我有特定需求**
→ 前往"4. 场景化模板"找到相似场景
→ 复制模板并修改为你的需求

**选项C - 我想深入研究**
→ 系统学习"12.4 学习路径建议"
→ 按周次完成练习任务

**选项D - 我遇到了问题**
→ 查看"7. 故障排除指南"
→ 使用"12.3 应急Prompt生成器"重新生成

---

🎨 **祝你创作出精彩的视觉作品！**

每一次生成都是一次创意探索，每一次迭代都是技能提升。相信通过这份详细的Skills手册，你将能够：

- 快速生成符合需求的高质量图片
- 建立稳定一致的视觉风格
- 高效处理各种商业和创意需求
- 持续优化个人工作流程

现在，打开你的Imagen 3.0界面，开始你的图片生成之旅吧！ 🚀

---

**附：快速复制模板（可直接使用）**

```json
// 通用商业摄影模板
{
  "prompt": "[您的主体描述], professional photography, [风格形容词] atmosphere, soft natural lighting, high quality, clean composition, 8K resolution",
  "config": {
    "aspectRatio": "1:1",
    "numberOfImages": 4
  },
  "negativePrompt": "blurry, low quality, distorted, watermark, cluttered"
}

// 社交媒体专用模板
{
  "prompt": "[您的内容], lifestyle photography, vibrant and engaging, Instagram aesthetic, eye-catching composition, professional quality",
  "config": {
    "aspectRatio": "1:1",
    "numberOfImages": 4
  },
  "negativePrompt": "boring, low quality, dark, messy, unfocused"
}

// 产品展示模板
{
  "prompt": "[产品名称] on clean background, product photography, sharp focus, professional lighting, commercial quality, e-commerce ready",
  "config": {
    "aspectRatio": "1:1",
    "numberOfImages": 4,
    "outputMimeType": "image/png"
  },
  "negativePrompt": "cluttered, shadows, poor lighting, low resolution"
}
```

复制以上模板，替换方括号内容，即可快速开始！

---

✅ **文档已完成！**

这是一份超过15,000字的完整、详细、可操作的Imagen 3.0图片生成Skills手册，涵盖了从入门到精通的所有内容。你可以将这份文档保存为你的专属技能库，每次创建AI智能体时都能确保生成效果达到预期！

