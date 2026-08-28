import { resolve } from 'path'
import { defineConfig, BuildOptions } from 'vite'
import { viteSingleFile } from "vite-plugin-singlefile"
import react from '@vitejs/plugin-react'
import { createHtmlPlugin } from 'vite-plugin-html'

const target = process.env.TARGET

export default defineConfig(() => {
  const buildConfig = target === 'ui'
    ? {
        target: "esnext",
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        brotliSize: false,
        rollupOptions: {
          output: {
            // Rollup 4 expects inlineDynamicImports under output. It cannot
            // be combined with manualChunks, and singlefile handles the
            // resulting bundle as one HTML asset.
            inlineDynamicImports: true,
          },
        },
      }
    : {
      lib: {
        entry: resolve(__dirname, './lib/main.ts'),
        name: 'myLib',
        formats: ['umd'],
        fileName: () => `main.js`
      },
    }

  return {
    plugins: [
      react(),
      viteSingleFile(),
      createHtmlPlugin(),
    ],
    build: {
      ...buildConfig as BuildOptions,
      emptyOutDir: false
    },
    resolve: {
      alias: {
        "@lib": resolve(__dirname, './lib'),
        "@ui": resolve(__dirname, './ui'),
        "@messages": resolve(__dirname, './messages'),
      }
    },
  }
})
