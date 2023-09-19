import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import rtcServer from './plugin/rtc-server'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    rtcServer()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
