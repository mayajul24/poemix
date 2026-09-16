import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// The plugin's default injected script only calls navigator.serviceWorker.register()
// with no update checking, so an already-open (or installed/standalone) PWA could sit
// on a stale build indefinitely. registerType:'autoUpdate' in vite.config.ts makes a
// new service worker activate in the background as soon as one is found - the browser
// looks on every navigation, plus here every hour for sessions left open.
//
// Without onNeedReload, this library's own default is to call window.location.reload()
// itself the instant that activation happens - silently, whenever it happens to land,
// including mid-paste or mid-drag. That's a hard bug, not just bad UX: it can nuke
// whatever the user was doing. Notify instead and let App.tsx show a dismissable
// "update ready" banner that reloads only when the user actually clicks it.
registerSW({
  immediate: true,
  onNeedReload() {
    window.dispatchEvent(new CustomEvent('sw-update-ready'))
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
