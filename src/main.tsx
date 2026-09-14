import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// The plugin's default injected script only calls navigator.serviceWorker.register()
// with no update checking, so an already-open (or installed/standalone) PWA could sit
// on a stale build indefinitely. registerType:'autoUpdate' in vite.config.ts makes a
// new service worker activate immediately once found and reload the page - but the
// browser has to actually go looking for one. It does that on every navigation, plus
// here every hour for sessions left open.
registerSW({
  immediate: true,
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
