# MANDATORY DESIGN SYSTEM: MICAS Monochromatic Dark Aesthetic (极简黑白色调法则)

> **CORE PRINCIPLE**: MICAS UI/UX must strictly maintain a **Pure Black & White Monochrome Aesthetic (纯粹极简黑白色调)**. Colored accent gradients, purple/blue/pink glows, and colored emojis are strictly prohibited in the UI components.

---

## 1. Color Palette Rules (色彩规范)

| Category | Hex Code | Usage |
| :--- | :--- | :--- |
| **App Background** | `#111111` | Main container & body background |
| **Card & Surface** | `#1B1B1B` / `#1F1F1F` | Modal cards, section boxes, toolbars |
| **Hover Surface** | `#242424` / `#282828` | Interactive element hover state |
| **Active / Selected Surface** | `#26262A` / `#383838` | Selected card item or active segment |
| **Input / Inner Surface** | `#202020` | Textarea, search inputs, dropdown containers |
| **Primary Text** | `#FFFFFF` / `#F5F5F5` | Headings, active labels, primary buttons |
| **Secondary Text** | `#A8A8A8` / `#D4D4D4` | Subtitles, regular labels, secondary info |
| **Muted Text** | `#737373` / `#888888` | Hints, placeholders, disabled text |
| **Borders** | `#303030` / `#404040` / `#555555` | Default component borders |
| **Active Borders** | `#FFFFFF` | Selected model cards, active focus rings |

---

## 2. Component Guidelines (组件设计要点)

### Modals & Dialogs (弹窗)
- **Backdrop**: `rgba(0, 0, 0, 0.75)` with `backdrop-filter: blur(12px)`.
- **Top Bar / Divider**: Pure monochrome gradient (`rgba(255,255,255,0.1)` to `rgba(255,255,255,0.5)`). **NO multi-color RGB gradients**.
- **Header Icon Badge**: Pure dark background (`#242424`) with white icon (`#FFFFFF`).

### Cards & Selection Items (卡片与选择项)
- **Normal State**: `#1B1B1B` background with `#303030` border.
- **Hover State**: `#242424` background with `#555555` border.
- **Selected State**: High-contrast white border (`#FFFFFF`), `#26262A` background, subtle white inset glow (`inset 0 1px 0 rgba(255,255,255,0.15)`).
- **Radio Buttons & Indicators**: Pure white background (`#FFFFFF`) with dark interior dot (`#111111`).

### Badges & Chips (标签与筛选按钮)
- **Filter Chips**:
  - Inactive: `#202020` background, `#303030` border, `#A8A8A8` text.
  - Active: `#FFFFFF` background, `#FFFFFF` border, `#111111` bold text.
- **Default Badge ("默认推荐")**: `#242424` dark background, `#3F3F3F` border, `#D4D4D4` text.
- **Active Badge ("使用中")**: `#FFFFFF` background, `#111111` text.

### Brand Icons & Emojis (图标与 Symbol)
- Use clean, monochrome characters/SVGs: `🌐`, `●`, `◆`, `⚡`, `⚙`.
- Avoid bright colored emojis (e.g. 🔴, 🔷, 🚀, 🎨) in component UI.

---

## 3. Strict Negative Anti-Patterns (禁忌事项)
- ❌ **DO NOT** use purple (`#8B5CF6`), blue (`#3B82F6`), pink (`#EC4899`) or neon accents for buttons, borders, dots, or glows.
- ❌ **DO NOT** use multi-color gradients on modal top bars or cards.
- ❌ **DO NOT** use colored radio dots or colored selection checkboxes.
- ❌ **ALWAYS** test UI components to ensure high contrast in pure dark/monochrome mode.
