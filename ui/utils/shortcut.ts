export const DEFAULT_SELECTION_SHORTCUT = 'Mod+Shift+V'

interface ShortcutKeyboardEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export function shortcutFromKeyboardEvent(event: ShortcutKeyboardEvent): string | null {
  const rawKey = event.key
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(rawKey)) return null

  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push('Mod')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (modifiers.length === 0) return null

  const key = rawKey.length === 1 ? rawKey.toUpperCase() : rawKey
  return [...modifiers, key].join('+')
}

export function formatShortcut(shortcut: string): string {
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
  return shortcut
    .split('+')
    .map((part) => part === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : part)
    .join(' + ')
}
