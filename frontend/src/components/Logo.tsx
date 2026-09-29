export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0a1522" stroke="#1a2c40" />
      <g stroke="#37d5d6" strokeLinecap="round" strokeWidth="2">
        <path d="M16 26a10 10 0 0 1 0-20" opacity=".4" />
        <path d="M16 22a6 6 0 0 1 0-12" opacity=".75" />
        <path d="M16 16 25 8" />
      </g>
      <circle cx="16" cy="16" r="2.2" fill="#37d5d6" />
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[17px] font-semibold tracking-[0.22em] text-mist">NEREUS</div>
          <div className="mt-1 text-[9px] tracking-[0.14em] text-haze">INTELLIGENT SONAR. SAFER SEAS.</div>
        </div>
      )}
    </div>
  )
}
