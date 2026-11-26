import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tipografías autoalojadas (sin CDN externo): Montserrat (titulares), Inter (UI), IBM Plex Mono (cifras).
import '@fontsource-variable/montserrat/wght.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles/index.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
