import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { runScheduler } from './data/store'
import './assets/main.css'
import logo from './assets/bsv-logo.png'

// Browser-tab icon: the round BSV mark cropped from the full logo (same region as BsvLogo.vue)
const img = new Image()
img.onload = () => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const sw = img.width * 0.31
  const sh = img.height * 0.74
  const dh = (64 * sh) / sw
  canvas.getContext('2d').drawImage(img, 0, 0, sw, sh, 0, (64 - dh) / 2, 64, dh)
  const link = document.querySelector('link[rel="icon"]')
  if (link) link.href = canvas.toDataURL('image/png')
}
img.src = logo

createApp(App).use(router).mount('#app')

// Sends due scheduled campaigns and automatic reminders while the app is open
runScheduler()
setInterval(runScheduler, 20000)
