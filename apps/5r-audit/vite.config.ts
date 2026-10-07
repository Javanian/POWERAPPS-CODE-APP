import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { powerApps } from '@microsoft/power-apps-vite/plugin'

export default defineConfig({
  plugins: [react(), powerApps()],
  build: {
    // Inline semua aset gambar sebagai data URI. `power-apps push`
    // merusak file biner terpisah saat upload (sama seperti CreateFile);
    // menanamkannya sebagai teks di bundle membuat logo ikut jalur teks yang
    // ter-upload utuh. Batas dibuat longgar agar gambar yang lebih besar ikut ter-inline.
    assetsInlineLimit: 512000,
  },
})
