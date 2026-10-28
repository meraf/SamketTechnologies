import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tw from '@tailwindcss/vite'
import {VitePWA} from 'vite-plugin-pwa'
// The service worker is src/sw.js (Workbox, injectManifest). We ship our own two manifests in /public
// (manifest-client.json, manifest-staff.json), so the plugin must not generate or inject one.
export default defineConfig({
 plugins:[react(),tw(),VitePWA({
  strategies:'injectManifest',srcDir:'src',filename:'sw.js',
  injectRegister:false,manifest:false,
  injectManifest:{rollupFormat:'iife',globPatterns:['**/*.{js,css,html,svg,png,json,woff2}'],maximumFileSizeToCacheInBytes:3e6},
 })],
 server:{proxy:{'/api':'http://localhost:3000'}}})
