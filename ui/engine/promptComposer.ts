import { ReferenceImage, ReferenceRole } from './types'

const ROLE_INSTRUCTIONS: Record<ReferenceRole, string> = {
  product: 'Primary Product Reference: Preserve exact product identity, structure, details, materials and design.',
  model: 'Model Identity Reference: Preserve model facial features, identity, body proportion and expression.',
  scene: 'Scene & Environment Reference: Use scene background composition, environment, lighting and atmosphere.',
  pose: 'Pose & Gesture Reference: Follow exact body pose, camera-relative orientation and gesture.',
  style: 'Style Reference: Apply visual aesthetic style, photography mood, color grading and rendering texture.',
  hair: 'Hair Reference: Match exact hairstyle, length, haircut style and hair color.',
  makeup: 'Makeup Reference: Follow makeup style, aesthetic, facial beauty details.',
  composition: 'Composition Reference: Follow framing, shot perspective and layout composition.',
  color: 'Color Palette Reference: Match color palette, grading and lighting warmth/coolness.',
  other: 'General Visual Reference: Use as overall visual guidance.',
}

export function composePromptWithRoles(
  userPrompt: string,
  references: ReferenceImage[]
): string {
  if (!references || references.length === 0) {
    return userPrompt
  }

  const roleLines = references.map((ref, idx) => {
    const instruction = ROLE_INSTRUCTIONS[ref.role] || ROLE_INSTRUCTIONS.other
    const customInstruction = ref.instruction ? ` (${ref.instruction})` : ''
    return `[Reference Image ${idx + 1} - Role: ${ref.role.toUpperCase()}]\n${instruction}${customInstruction}`
  })

  return `=== REFERENCE ROLES MAP ===\n${roleLines.join('\n\n')}\n\n=== USER CREATIVE REQUEST ===\n${userPrompt}`
}
