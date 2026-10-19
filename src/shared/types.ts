export type PresetId = 'claude' | 'codex' | 'shell' | 'custom'

export type Settings = {
  presetId: PresetId
  customCommand: string
  cwd: string
  toolRatio: number
  clipRatio: number
  filesRatio: number
  heightRatio: number
  showTrayIcon: boolean
}

export type Clip = {
  id: string
  kind: 'text' | 'image'
  preview: string
  text: string | null
  thumb: string | null
  favorite: boolean
  createdAt: number
}

export type Note = {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

export type ShelfFile = {
  id: string
  path: string
  name: string
  addedAt: number
}

export type FileInfo = {
  kind: 'folder' | 'file' | 'missing'
  ext: string
  thumb: string | null
}

export type ToolStatus = {
  running: boolean
  presetId: PresetId
  label: string
  cwd: string
  error: string | null
  exitCode: number | null
}

export type PtyChunk = {
  rev: number
  chunk: string
}

export type PtySnapshot = {
  buffer: string
  rev: number
}

export type AppState = {
  settings: Settings
  clips: Clip[]
  notes: Note[]
  files: ShelfFile[]
  tool: ToolStatus
  gestureTrusted: boolean
  shortcut: string
  canAutoLaunch: boolean
  launchAtLogin: boolean
}

// Menu-bar preferences pushed to the page whenever one of them changes.
export type Prefs = {
  showTrayIcon: boolean
  launchAtLogin: boolean
}

export type ToolConfig = {
  presetId?: PresetId
  customCommand?: string
  cwd?: string
}

export type ActionResult = {
  ok: boolean
  error?: string
}

export const PRESETS: { id: PresetId; label: string; command: string }[] = [
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'codex', label: 'Codex', command: 'codex' },
  { id: 'shell', label: 'Shell', command: 'shell' },
  { id: 'custom', label: 'Custom', command: '' }
]

export function presetLabel(id: PresetId): string {
  return PRESETS.find((preset) => preset.id === id)?.label ?? 'Tool'
}

export function isPresetId(value: unknown): value is PresetId {
  return value === 'claude' || value === 'codex' || value === 'shell' || value === 'custom'
}
