interface OpucLogoProps {
  size?: number
  className?: string
  variant?: 'full' | 'icon' | 'mono'
}

/**
 * OPUC Logo — Professional construction management mark.
 * Combines a building structure with crane arm in a bold geometric composition.
 */
export function OpucLogo({ size = 40, className, variant = 'icon' }: OpucLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="O.P.U.C. Logo"
    >
      <defs>
        {/* Main gradient: amber → orange */}
        <linearGradient id="logoGradMain" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>

        {/* Crane / accent gradient */}
        <linearGradient id="logoGradAccent" x1="0" y1="0" x2="80" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        {/* Inner glow */}
        <linearGradient id="logoGradInner" x1="60" y1="0" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Drop shadow filter */}
        <filter id="logoShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F97316" floodOpacity="0.35" />
        </filter>

        {/* Clip for rounded container */}
        <clipPath id="logoClip">
          <rect x="4" y="4" width="112" height="112" rx="28" />
        </clipPath>
      </defs>

      {/* Background container with gradient */}
      <rect
        x="4" y="4"
        width="112" height="112"
        rx="28"
        fill="url(#logoGradMain)"
        filter="url(#logoShadow)"
      />

      {/* Subtle inner glass effect */}
      <rect
        x="4" y="4"
        width="112" height="56"
        rx="28"
        fill="url(#logoGradInner)"
        clipPath="url(#logoClip)"
      />

      <g clipPath="url(#logoClip)">
        {/* ═══ Building Structure ═══ */}
        {/* Main tower body */}
        <rect x="22" y="38" width="48" height="58" rx="3" fill="white" fillOpacity="0.95" />

        {/* Tower floors — window grid */}
        {[0, 1, 2, 3].map((row) => (
          <g key={`row-${row}`}>
            {[0, 1, 2].map((col) => (
              <rect
                key={`win-${row}-${col}`}
                x={28 + col * 14}
                y={44 + row * 14}
                width="8" height="8"
                rx="1.5"
                fill={row < 3 && col < 2 ? "url(#logoGradMain)" : "white"}
                fillOpacity={row < 3 && col < 2 ? 0.7 : 0.85}
              />
            ))}
          </g>
        ))}

        {/* Tower roof detail */}
        <rect x="18" y="34" width="56" height="6" rx="2" fill="white" fillOpacity="0.95" />

        {/* ═══ Crane Arm ═══ */}
        {/* Vertical mast */}
        <rect x="76" y="18" width="6" height="78" rx="2" fill="url(#logoGradAccent)" />

        {/* Horizontal boom */}
        <rect x="42" y="16" width="50" height="5" rx="2" fill="url(#logoGradAccent)" />

        {/* Boom tip triangle */}
        <polygon points="90,13 90,24 98,18.5" fill="#FCD34D" />

        {/* Counter-jib (short side) */}
        <rect x="68" y="16" width="14" height="5" rx="2" fill="#FBBF24" />

        {/* Counterweight */}
        <rect x="64" y="12" width="10" height="7" rx="2" fill="white" fillOpacity="0.8" />

        {/* Crane support cables (lines) */}
        <line x1="82" y1="4" x2="95" y2="16" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="82" y1="4" x2="68" y2="16" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />

        {/* Crane hook (dangling from boom tip) */}
        <line x1="95" y1="18.5" x2="95" y2="32" stroke="#FCD34D" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M91,32 L95,38 L99,32" stroke="#FCD34D" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Crane base (on the building) */}
        <rect x="73" y="94" width="12" height="6" rx="2" fill="white" fillOpacity="0.6" />

        {/* ═══ Ground / Foundation line ═══ */}
        <rect x="14" y="96" width="92" height="4" rx="2" fill="white" fillOpacity="0.3" />

        {/* Small construction elements — concrete block */}
        <rect x="14" y="72" width="14" height="22" rx="2" fill="white" fillOpacity="0.4" />
        <line x1="21" y1="72" x2="21" y2="94" stroke="white" strokeOpacity="0.25" strokeWidth="1" />

        {/* Tiny scaffolding detail */}
        <rect x="14" y="68" width="1.5" height="4" fill="white" fillOpacity="0.3" />
        <rect x="26.5" y="68" width="1.5" height="4" fill="white" fillOpacity="0.3" />
        <rect x="14" y="70" width="14" height="1.2" fill="white" fillOpacity="0.2" />

        {/* ═══ Decorative dots — construction particles ═══ */}
        <circle cx="100" cy="45" r="1.8" fill="white" fillOpacity="0.5" />
        <circle cx="106" cy="52" r="1.2" fill="white" fillOpacity="0.35" />
        <circle cx="97" cy="56" r="1" fill="white" fillOpacity="0.25" />
        <circle cx="104" cy="40" r="0.8" fill="white" fillOpacity="0.3" />
      </g>

      {/* Border highlight — top-left shine */}
      <rect
        x="4" y="4"
        width="112" height="112"
        rx="28"
        fill="none"
        stroke="white"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />
    </svg>
  )
}

/**
 * Lightweight inline logo for favicon or tiny contexts.
 */
export function OpucLogoSmall({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="smGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#smGrad)" />
      {/* Simplified building */}
      <rect x="22" y="38" width="48" height="58" rx="3" fill="white" fillOpacity="0.95" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={28 + c * 14} y={44 + r * 14} width="8" height="8" rx="1.5"
            fill={r < 3 && c < 2 ? '#EA580C' : 'white'} fillOpacity={r < 3 && c < 2 ? 0.7 : 0.85} />
        ))
      )}
      <rect x="18" y="34" width="56" height="6" rx="2" fill="white" fillOpacity="0.95" />
      {/* Crane mast */}
      <rect x="76" y="18" width="6" height="78" rx="2" fill="#FCD34D" />
      {/* Crane boom */}
      <rect x="42" y="16" width="50" height="5" rx="2" fill="#FCD34D" />
      <polygon points="90,13 90,24 98,18.5" fill="#FCD34D" />
      <line x1="82" y1="4" x2="95" y2="16" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="82" y1="4" x2="68" y2="16" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />
      {/* Hook */}
      <line x1="95" y1="18.5" x2="95" y2="32" stroke="#FCD34D" strokeWidth="1.2" />
      <path d="M91,32 L95,38 L99,32" stroke="#FCD34D" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Ground */}
      <rect x="14" y="96" width="92" height="4" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="14" y="72" width="14" height="22" rx="2" fill="white" fillOpacity="0.4" />
    </svg>
  )
}
