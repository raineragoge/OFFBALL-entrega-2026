import { useMode, type UiMode } from '../../state/prefs'
import { useToast } from '../ui/toast'
import { Segmented } from '../ui/primitives'

/**
 * Selector global Esencial / Avanzado. Conserva la página, el jugador, los
 * filtros y el estado de navegación: sólo cambia qué se muestra.
 */
export function ModeSwitch({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  const { mode, setMode } = useMode()
  const toast = useToast()
  const change = (m: UiMode) => {
    if (m === mode) return
    setMode(m)
    toast(m === 'avanzado' ? 'Modo Avanzado: probabilidades, residuos, métricas y exportación visibles.' : 'Modo Esencial: lo imprescindible, explicado en claro.')
  }
  return (
    <div className={className}>
      <Segmented<UiMode>
        label="Nivel de detalle"
        size={size}
        value={mode}
        onChange={change}
        options={[
          { value: 'esencial', label: 'Esencial', hint: 'Conclusiones rápidas y explicaciones breves' },
          { value: 'avanzado', label: 'Avanzado', hint: 'Probabilidades GMM, residuos, métricas y exportación' },
        ]}
      />
    </div>
  )
}
