interface OpucLogoProps {
  size?: number
  className?: string
  variant?: 'full' | 'icon' | 'mono'
}

/**
 * OPUC Logo — Professional construction management mark.
 * Dark silhouette building + crane on amber gradient for maximum contrast.
 */
export function OpucLogo({ size = 40, className }: OpucLogoProps) {
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
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Crane gradient */}
        <linearGradient id="logoGradCrane" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>

        {/* Building gradient */}
        <linearGradient id="logoGradBldg" x1="20" y1="30" x2="70" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1C1917" />
          <stop offset="100%" stopColor="#292524" />
        </linearGradient>

        {/* Window glow */}
        <linearGradient id="logoGradWin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>

        {/* Inner glass highlight */}
        <linearGradient id="logoGradShine" x1="60" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.30" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Drop shadow */}
        <filter id="logoShadow" x="-15%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#92400E" floodOpacity="0.4" />
        </filter>

        <clipPath id="logoClip">
          <rect x="4" y="4" width="112" height="112" rx="28" />
        </clipPath>
      </defs>

      {/* ═══ Background Container ═══ */}
      <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#logoGradMain)" filter="url(#logoShadow)" />

      {/* Top glass highlight */}
      <rect x="4" y="4" width="112" height="50" rx="28" fill="url(#logoGradShine)" clipPath="url(#logoClip)" />

      <g clipPath="url(#logoClip)">
        {/* ═══════════════════════════════
            BUILDING STRUCTURE — dark silhouette
           ═══════════════════════════════ */}
        {/* Main tower */}
        <rect x="18" y="36" width="50" height="62" rx="3" fill="url(#logoGradBldg)" />

        {/* Roof cornice */}
        <rect x="14" y="32" width="58" height="6" rx="2.5" fill="#1C1917" />
        <rect x="16" y="30" width="54" height="3" rx="1.5" fill="#292524" />

        {/* Roof antenna */}
        <rect x="43" y="22" width="2" height="10" fill="#44403C" />
        <circle cx="44" cy="20" r="2" fill="#EF4444" />

        {/* ═══ Windows — glowing amber/yellow ═══ */}
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2].map((col) => {
            const lit = (row + col) % 2 !== 0
            return (
              <rect
                key={`w-${row}-${col}`}
                x={24 + col * 14}
                y={42 + row * 14}
                width="8"
                height="8"
                rx="1.5"
                fill={lit ? "url(#logoGradWin)" : "#44403C"}
                opacity={lit ? 0.95 : 0.5}
              />
            )
          })
        )}

        {/* ═══ Secondary block (left) ═══ */}
        <rect x="6" y="70" width="16" height="26" rx="2" fill="#292524" />
        <rect x="9" y="74" width="4" height="4" rx="1" fill="url(#logoGradWin)" opacity="0.8" />
        <rect x="15" y="74" width="4" height="4" rx="1" fill="#44403C" opacity="0.5" />
        <rect x="9" y="82" width="4" height="4" rx="1" fill="#44403C" opacity="0.5" />
        <rect x="15" y="82" width="4" height="4" rx="1" fill="url(#logoGradWin)" opacity="0.8" />

        {/* ═══════════════════════════════
            CRANE — dark with gold cables
           ═══════════════════════════════ */}
        {/* Vertical mast */}
        <rect x="78" y="14" width="7" height="84" rx="2.5" fill="url(#logoGradCrane)" />

        {/* Horizontal boom */}
        <rect x="40" y="12" width="52" height="6" rx="2.5" fill="url(#logoGradCrane)" />

        {/* Boom tip arrow */}
        <polygon points="90,8 90,20 99,14" fill="#451A03" />

        {/* Counter-jib */}
        <rect x="66" y="12" width="16" height="6" rx="2.5" fill="#57534E" />

        {/* Counterweight */}
        <rect x="62" y="6" width="12" height="9" rx="2.5" fill="#57534E" />
        <rect x="64" y="8" width="8" height="5" rx="1.5" fill="#44403C" />

        {/* ═══ Crane cables — gold ═══ */}
        <line x1="84" y1="0" x2="98" y2="12" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
        <line x1="84" y1="0" x2="66" y2="12" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />

        {/* Crane cabin */}
        <rect x="76" y="14" width="11" height="9" rx="2" fill="#44403C" />
        <rect x="78" y="16" width="7" height="4" rx="1" fill="url(#logoGradWin)" opacity="0.6" />

        {/* Crane hook */}
        <line x1="96" y1="14" x2="96" y2="34" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M92,34 L96,41 L100,34" stroke="#FCD34D" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* ═══ Ground line ═══ */}
        <rect x="2" y="96" width="116" height="5" rx="2" fill="#78350F" opacity="0.5" />

        {/* ═══ Scaffolding detail ═══ */}
        <rect x="5" y="66" width="1.5" height="6" fill="#57534E" />
        <rect x="21.5" y="66" width="1.5" height="6" fill="#57534E" />
        <rect x="5" y="69" width="18" height="1.5" fill="#57534E" />
      </g>

      {/* ═══ Border highlight ═══ */}
      <rect x="4" y="4" width="112" height="112" rx="28" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
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
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#smGrad)" />
      {/* Building */}
      <rect x="18" y="36" width="50" height="62" rx="3" fill="#1C1917" />
      <rect x="14" y="32" width="58" height="6" rx="2.5" fill="#1C1917" />
      {/* Windows — lit pattern */}
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={24 + c * 14} y={42 + r * 14} width="8" height="8" rx="1.5"
            fill={(r + c) % 2 !== 0 ? '#FEF3C7' : '#44403C'} opacity={(r + c) % 2 !== 0 ? 0.95 : 0.5} />
        ))
      )}
      {/* Side block */}
      <rect x="6" y="70" width="16" height="26" rx="2" fill="#292524" />
      {/* Crane mast */}
      <rect x="78" y="14" width="7" height="84" rx="2.5" fill="#451A03" />
      {/* Crane boom */}
      <rect x="40" y="12" width="52" height="6" rx="2.5" fill="#451A03" />
      <polygon points="90,8 90,20 99,14" fill="#451A03" />
      {/* Cables */}
      <line x1="84" y1="0" x2="98" y2="12" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
      <line x1="84" y1="0" x2="66" y2="12" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
      {/* Hook */}
      <line x1="96" y1="14" x2="96" y2="34" stroke="#FCD34D" strokeWidth="1.8" />
      <path d="M92,34 L96,41 L100,34" stroke="#FCD34D" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Ground */}
      <rect x="2" y="96" width="116" height="5" rx="2" fill="#78350F" opacity="0.5" />
    </svg>
  )
}
