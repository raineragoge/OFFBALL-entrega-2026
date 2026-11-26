/**
 * Marcas reglamentarias de media cancha (metros, ataque hacia arriba).
 * Trazo con vector-effect non-scaling-stroke: grosor constante al hacer zoom.
 */
import { PITCH } from '../../domain/pitch'

export function PitchMarkings({ stroke = '#3c5a4c', opacity = 1 }: { stroke?: string; opacity?: number }) {
  const P = PITCH
  const cx = P.width / 2
  const boxX = cx - P.boxW / 2
  const sixX = cx - P.sixW / 2
  const dy = P.boxD - P.spot
  const dx = Math.sqrt(P.arcR * P.arcR - dy * dy)
  const common = { vectorEffect: 'non-scaling-stroke' as const }
  return (
    <g fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" opacity={opacity} {...common}>
      <rect x={0} y={0} width={P.width} height={P.depth} {...common} />
      <rect x={boxX} y={0} width={P.boxW} height={P.boxD} {...common} />
      <rect x={sixX} y={0} width={P.sixW} height={P.sixD} {...common} />
      <rect x={cx - P.goalW / 2} y={-P.goalD} width={P.goalW} height={P.goalD} {...common} />
      <path d={`M ${cx - dx} ${P.boxD} A ${P.arcR} ${P.arcR} 0 0 0 ${cx + dx} ${P.boxD}`} {...common} />
      <path d={`M ${cx - P.arcR} ${P.depth} A ${P.arcR} ${P.arcR} 0 0 1 ${cx + P.arcR} ${P.depth}`} {...common} />
      <circle cx={cx} cy={P.spot} r={0.35} fill={stroke} stroke="none" />
      <circle cx={cx} cy={P.depth} r={0.45} fill={stroke} stroke="none" />
      <path d={`M 0 ${P.cornerR} A ${P.cornerR} ${P.cornerR} 0 0 0 ${P.cornerR} 0`} {...common} />
      <path d={`M ${P.width - P.cornerR} 0 A ${P.cornerR} ${P.cornerR} 0 0 0 ${P.width} ${P.cornerR}`} {...common} />
    </g>
  )
}

/** Césped con franjas de corte (decoración sobria, 5,25 m por franja). */
export function PitchTurf({ id }: { id: string }) {
  return (
    <>
      <defs>
        <pattern id={id} width={PITCH.width} height={10.5} patternUnits="userSpaceOnUse">
          <rect width={PITCH.width} height={5.25} fill="#10201a" />
          <rect y={5.25} width={PITCH.width} height={5.25} fill="#0f1d17" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={PITCH.width} height={PITCH.depth} fill={`url(#${id})`} />
    </>
  )
}
