/**
 * Logotipo OFFBALL.
 * Usa el ARCHIVO MAESTRO aprobado (public/brand/offball-logo.jpg, 2048 × 635)
 * sin redibujarlo ni recolorearlo: cada variante es un recorte (viewBox) del
 * original. Un filtro SVG convierte en transparente SOLO el fondo verde noche
 * del JPG (luminancia ≈ 0,09): el canal alfa sube con la luminancia y los
 * colores RGB del blanco y del salvia no se modifican.
 */
import { useId } from 'react'

const SRC = '/brand/offball-logo.jpg'
const W = 2048
const H = 635

const CROPS = {
  /** Logotipo completo con descriptor "Football Intelligence". */
  lockup: '170 80 1730 520',
  /** Palabra OFFBALL con balón, sin descriptor. */
  wordmark: '205 100 1665 325',
  /** "O" con retícula de esquinas. */
  isotipo: '212 104 318 318',
} as const

export type LogoVariant = keyof typeof CROPS

export function Logo({ variant = 'wordmark', className, title = 'OFFBALL' }: { variant?: LogoVariant; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox={CROPS[variant]} className={className} role="img" aria-label={title} style={{ display: 'block' }}>
      <defs>
        <filter id={`${id}-ko`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="6" intercept="-0.62" />
          </feComponentTransfer>
        </filter>
      </defs>
      <image href={SRC} width={W} height={H} preserveAspectRatio="none" filter={`url(#${id}-ko)`} />
    </svg>
  )
}
