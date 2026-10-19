import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['electron/**/*.ts', 'src/**/*.{ts,tsx}', 'scripts/**/*.mjs'],
      exclude: ['src/vite-env.d.ts'],
      reporter: ['text', 'html'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    },
    projects: [
      {
        // Main process: real SQL via node:sqlite, everything native mocked.
        resolve: {
          alias: {
            'better-sqlite3': at('./test/shims/better-sqlite3.ts'),
            'node-pty': at('./test/mocks/node-pty.ts'),
            electron: at('./test/mocks/electron.ts')
          }
        },
        test: {
          name: 'main',
          environment: 'node',
          include: ['test/electron/**/*.test.ts', 'test/scripts/**/*.test.ts'],
          setupFiles: ['test/helpers/setup-node.ts'],
          mockReset: true
        }
      },
      {
        // Renderer: React in jsdom, xterm replaced by a fake.
        plugins: [react()],
        resolve: {
          alias: {
            '@xterm/xterm/css/xterm.css': at('./test/mocks/empty.css'),
            '@xterm/xterm': at('./test/mocks/xterm.ts'),
            '@xterm/addon-fit': at('./test/mocks/addon-fit.ts')
          }
        },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['test/src/**/*.test.{ts,tsx}'],
          setupFiles: ['test/helpers/setup-dom.ts'],
          mockReset: true,
          css: false
        }
      }
    ]
  }
})
