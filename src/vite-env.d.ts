/// <reference types="vite/client" />

import type { PerchApi } from '../electron/preload'

declare global {
  interface Window {
    perch: PerchApi
  }
}

export {}
