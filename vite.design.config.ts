import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/renderer',
  server: {
    port: 5173,
    strictPort: false,
    open: true
  },
  build: {
    outDir: '../../out/design',
    emptyOutDir: true
  }
})
