<<<<<<< HEAD
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
=======
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
  },
})
