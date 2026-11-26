/**
 * Iconografía OFFBALL — trazo de 1,75 px sobre retícula de 24 px, extremos
 * redondeados (misma gramática que Lucide). Dibujados en el proyecto para no
 * depender de paquetes externos; se pueden sustituir por lucide-react 1:1.
 */
import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

const make = (paths: ReactNode) => (p: IconProps) => <Base {...p}>{paths}</Base>

export const IconHome = make(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>)
export const IconTarget = make(<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4" /></>)
export const IconPitch = make(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 12h18" /><circle cx="12" cy="12" r="2.6" /><path d="M8 4v3.2h8V4M8 20v-3.2h8V20" /></>)
export const IconMarket = make(<><path d="M3 20h18" /><path d="M5 16l4.5-5 3.5 3 6-7" /><path d="M15 7h4v4" /></>)
export const IconColumns = make(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16M15 4v16" /></>)
export const IconBookmark = make(<path d="M6 3h12v18l-6-4-6 4z" />)
export const IconBook = make(<><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20" /><path d="M8 7h8M8 10.5h5" /></>)
export const IconSearch = make(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>)
export const IconChevronRight = make(<path d="m9 6 6 6-6 6" />)
export const IconChevronLeft = make(<path d="m15 6-6 6 6 6" />)
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />)
export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />)
export const IconPlus = make(<path d="M12 5v14M5 12h14" />)
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconAlert = make(<><path d="M12 3.5 21.5 20h-19z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></>)
export const IconInfo = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r=".6" fill="currentColor" /></>)
export const IconRefresh = make(<><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20.5V16h-4.5" /></>)
export const IconDownload = make(<><path d="M12 4v11" /><path d="m7 10.5 5 5 5-5" /><path d="M4 20h16" /></>)
export const IconUpload = make(<><path d="M12 16V5" /><path d="m7 9.5 5-5 5 5" /><path d="M4 20h16" /></>)
export const IconTrash = make(<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>)
export const IconWifiOff = make(<><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-3-2" /><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5" /><circle cx="12" cy="20" r=".8" fill="currentColor" /></>)
export const IconArrowUpRight = make(<path d="M7 17 17 7M8 7h9v9" />)
export const IconMenu = make(<path d="M4 7h16M4 12h16M4 17h16" />)
export const IconSliders = make(<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>)
export const IconClock = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
export const IconDatabase = make(<><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13" /><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" /></>)
export const IconPlay = make(<path d="M7 4.5v15l12-7.5z" />)
export const IconSave = make(<><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3" /><path d="M8 21v-6h8v6" /></>)
export const IconLayers = make(<><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>)
export const IconSignal = make(<><path d="M5 20v-3M10 20v-7M15 20V9M20 20V4" /></>)
export const IconFile = make(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></>)
export const IconExternal = make(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v6H4V6h6" /></>)
export const IconUser = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>)
export const IconCompass = make(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>)
export const IconFilter = make(<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z" />)
export const IconEdit = make(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>)
export const IconSparkline = make(<path d="M3 17l5-5 4 3 9-9" />)
export const IconMinus = make(<path d="M5 12h14" />)
export const IconFullscreen = make(<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />)
export const IconScatter = make(<><path d="M4 4v16h16" /><circle cx="9" cy="14" r="1.3" /><circle cx="13" cy="9.5" r="1.3" /><circle cx="17" cy="12" r="1.3" /><circle cx="16" cy="6.5" r="1.3" /></>)
export const IconRadar = make(<><path d="m12 3 8.5 6.2-3.3 10H6.8L3.5 9.2z" /><path d="m12 8 4 3-1.6 4.7H9.6L8 11z" /></>)
export const IconProfiles = make(<><circle cx="8" cy="9" r="3.2" /><circle cx="16.5" cy="8" r="2.4" /><path d="M2.5 19.5a5.6 5.6 0 0 1 11 0" /><path d="M14.5 14.2a4.6 4.6 0 0 1 7 3.8" /></>)
export const IconGauge = make(<><path d="M4.5 17a8 8 0 1 1 15 0" /><path d="m12 13 4-4" /><circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none" /></>)
export const IconList = make(<><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".8" fill="currentColor" /><circle cx="4.5" cy="12" r=".8" fill="currentColor" /><circle cx="4.5" cy="18" r=".8" fill="currentColor" /></>)
export const IconTable = make(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9.5h18M3 15h18M9 9.5V20" /></>)
export const IconResidual = make(<><path d="M3 12h18" strokeDasharray="2 2.5" /><path d="M6 12V7M10 12v4M14 12V5M18 12v6" /></>)
export const IconCommand = make(<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />)
export const IconEssential = make(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /></>)
export const IconAdvanced = make(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.2" /><circle cx="12" cy="12" r="1.8" /></>)
export const IconArrowRight = make(<path d="M5 12h14M13 6l6 6-6 6" />)
