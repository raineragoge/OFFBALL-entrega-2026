/**
 * Contorno decorativo del campo (estados vacíos, fondos). Sin datos.
 * El mapa con datos vive en components/pitch/TacticalMap.tsx.
 */
import { PITCH_VIEWBOX } from '../../domain/pitch'
import { PitchMarkings } from '../pitch/PitchMarkings'

export function PitchOutline({ className, stroke = '#2f4a3e' }: { className?: string; stroke?: string }) {
  const vb = PITCH_VIEWBOX
  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className={className} aria-hidden="true">
      <PitchMarkings stroke={stroke} />
    </svg>
  )
}
