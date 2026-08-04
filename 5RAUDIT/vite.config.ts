import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { powerApps } from '@microsoft/power-apps-vite/plugin'

export default defineConfig({
  plugins: [react(), powerApps()],
  build: {
    // Inline SEMUA aset (logo PNG) sebagai data URI base64. `power-apps push`
    // merusak file biner terpisah saat upload (sama seperti CreateFile);
    // menanamkannya sebagai teks di bundle membuat logo ikut jalur teks yang
    // ter-upload utuh. Batas > 400KB agar 5S_MR.png (355KB) ikut ter-inline.
    assetsInlineLimit: 512000,
  },
})
