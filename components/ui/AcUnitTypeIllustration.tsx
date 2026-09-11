import { AirVent } from 'lucide-react'

interface Props {
  label: string
  className?: string
  size?: number
}

const GLYPH_PROPS = {
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function WallMountedGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} {...GLYPH_PROPS}>
      <line x1="6" y1="6" x2="6" y2="58" />
      <rect x="10" y="16" width="34" height="14" rx="3" />
      <line x1="15" y1="21" x2="39" y2="21" />
      <line x1="15" y1="25" x2="39" y2="25" />
      <path d="M44 26c4 3 6 8 6 14" />
      <path d="M44 30c6 3 9 9 9 17" />
    </svg>
  )
}

function DuctedGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} {...GLYPH_PROPS}>
      <line x1="6" y1="10" x2="58" y2="10" />
      <rect x="16" y="10" width="32" height="8" />
      <rect x="20" y="18" width="24" height="6" rx="1.5" />
      <path d="M26 24v10" />
      <path d="M32 24v14" />
      <path d="M38 24v10" />
    </svg>
  )
}

function CassetteGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} {...GLYPH_PROPS}>
      <line x1="6" y1="10" x2="58" y2="10" />
      <rect x="14" y="10" width="36" height="18" rx="2" />
      <circle cx="32" cy="19" r="4" />
      <path d="M18 30c-2 4-3 9-3 15" />
      <path d="M27 30c-1 4-1.5 9-1.5 15" />
      <path d="M37 30c1 4 1.5 9 1.5 15" />
      <path d="M46 30c2 4 3 9 3 15" />
    </svg>
  )
}

export function AcUnitTypeIllustration({ label, className, size = 56 }: Props) {
  const normalized = label.toLowerCase().replace(/\bunit\b/g, '').trim()
  const style = { width: size, height: size }
  const cls = className

  if (normalized.includes('wall')) return <div style={style}><WallMountedGlyph className={cls} /></div>
  if (normalized.includes('duct')) return <div style={style}><DuctedGlyph className={cls} /></div>
  if (normalized.includes('cassette')) return <div style={style}><CassetteGlyph className={cls} /></div>
  return <div style={style} className="flex items-center justify-center"><AirVent size={size * 0.7} className={cls} strokeWidth={1.75} /></div>
}
