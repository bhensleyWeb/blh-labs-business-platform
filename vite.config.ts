import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: resolve(projectRoot, 'client'),
  base: '/optimize/back-office/',
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      // The frontend entry imports the app source and shared site styles.
      allow: [resolve(projectRoot, '..')],
    },
    proxy: { '/api': process.env.VITE_API_TARGET || 'http://localhost:8787' },
  },
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
  },
})
