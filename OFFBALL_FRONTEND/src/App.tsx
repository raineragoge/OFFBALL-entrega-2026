import { useEffect, useState, type JSX } from 'react'
import { IconCompass } from './components/icons'
import { Shell } from './components/layout/Shell'
import { activeNav } from './components/layout/nav'
import { Button, EmptyState, Notice, Panel } from './components/ui/primitives'
import { ToastProvider } from './components/ui/toast'
import { AnalyzePage } from './pages/Analyze'
import { ComparePage } from './pages/Compare'
import { DataHubPage } from './pages/DataHub'
import { TacticalStudioPage } from './pages/TacticalStudio'
import { SquadPage } from './pages/Squad'
import { Intro } from './pages/Intro'
import { HomePage } from './pages/Home'
import { MarketDetailPage } from './pages/MarketDetail'
import { MarketPage } from './pages/Market'
import { MethodologyPage } from './pages/Methodology'
import { ModelPerformancePage } from './pages/ModelPerformance'
import { PositionalPage } from './pages/Positional'
import { ProfilesPage } from './pages/Profiles'
import { TrackingPage } from './pages/Tracking'
import { Link, useRoute } from './router/router'
import { ApiStatusProvider } from './state/api-status'
import { useMode } from './state/prefs'

const ROUTES: Record<string, { el: () => JSX.Element; title: string }> = {
  '/': { el: HomePage, title: 'Centro de scouting' },
  '/plantilla': { el: SquadPage, title: 'Mi plantilla' },
  '/database': { el: DataHubPage, title: 'Base de jugadores' },
  '/tactica': { el: TacticalStudioPage, title: 'Laboratorio táctico' },
  '/analizar': { el: AnalyzePage, title: 'Analizar jugador' },
  '/mercado/ficha': { el: MarketDetailPage, title: 'Ficha de scouting' },
  '/mercado': { el: MarketPage, title: 'Mercado' },
  '/comparador': { el: ComparePage, title: 'Comparador' },
  '/perfiles': { el: ProfilesPage, title: 'Perfiles deportivos' },
  '/seguimiento': { el: TrackingPage, title: 'Seguimiento' },
  '/rendimiento': { el: ModelPerformancePage, title: 'Rendimiento del modelo' },
  '/posicional': { el: PositionalPage, title: 'Afinidad rápida' },
  '/metodologia': { el: MethodologyPage, title: 'Metodología' },
}

function NotFound() {
  return (
    <Panel>
      <EmptyState
        icon={<IconCompass size={20} />}
        title="Página no encontrada"
        action={
          <Link to="/" className="text-sm font-semibold text-lime underline underline-offset-4">
            Volver al inicio
          </Link>
        }
      >
        La ruta no existe en OFFBALL.
      </EmptyState>
    </Panel>
  )
}

/** Aviso al abrir una herramienta técnica desde el modo Esencial (no bloquea). */
function AdvancedNotice() {
  const { setMode } = useMode()
  return (
    <Notice className="mb-6" title="Herramienta del modo Avanzado">
      <span className="flex flex-wrap items-center gap-3">
        Esta página muestra información técnica. Puedes consultarla igualmente o cambiar de modo para ver todos los detalles.
        <Button size="sm" variant="secondary" onClick={() => setMode('avanzado')}>
          Cambiar a Avanzado
        </Button>
      </span>
    </Notice>
  )
}

function Router() {
  const { path } = useRoute()
  const { advanced } = useMode()
  const route = ROUTES[path]
  const nav = activeNav(path)
  useEffect(() => {
    document.title = `${route?.title ?? 'No encontrada'} · OFFBALL`
  }, [route])
  const Page = route?.el ?? NotFound
  return (
    <div key={path}>
      {nav?.advancedOnly && !advanced && <AdvancedNotice />}
      <Page />
    </div>
  )
}

export function App() {
  const [intro,setIntro] = useState(() => { try { return window.location.pathname==='/' && !sessionStorage.getItem('offball.intro.session.v042') } catch { return true } })
  const close=()=>{try{sessionStorage.setItem('offball.intro.session.v042','1')}catch{};setIntro(false)}
  return (
    <ApiStatusProvider>
      <ToastProvider>
        {intro ? <Intro onClose={close}/> : <Shell onReplayIntro={()=>setIntro(true)}>
          <Router />
        </Shell>}
      </ToastProvider>
    </ApiStatusProvider>
  )
}
