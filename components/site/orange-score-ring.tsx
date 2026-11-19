import { cn } from '@/lib/utils'

type OrangeScoreRingProps = {
  value: number
  max?: number
  label?: string
  sublabel?: string
  className?: string
  showTicks?: boolean
}

const RADIUS = 80
const STROKE = 12
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const TICK_COUNT = 60

export function OrangeScoreRing({
  value,
  max = 100,
  label = 'Orange Score',
  sublabel,
  className,
  showTicks = true,
}: OrangeScoreRingProps) {
  const id = 'or-score'
  const progress = Math.min(Math.max(value / max, 0), 1)
  const offset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className={cn('relative aspect-square w-full', className)}>
      <svg
        viewBox="0 0 200 200"
        className="block size-full overflow-visible"
        role="img"
        aria-label={`${label}: ${value} out of ${max}`}
      >
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FE7F04" />
            <stop offset="100%" stopColor="#FE6D00" />
          </linearGradient>
          <radialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(254 109 0 / 0.22)" />
            <stop offset="100%" stopColor="rgb(254 109 0 / 0)" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="100" r="70" fill={`url(#glow-${id})`} />

        {showTicks &&
          Array.from({ length: TICK_COUNT }).map((_, i) => {
            const angle = (i / TICK_COUNT) * Math.PI * 2 - Math.PI / 2
            const inner = 92
            const outer = i % 5 === 0 ? 97 : 95
            const active = i / TICK_COUNT < progress
            return (
              <line
                key={i}
                x1={100 + Math.cos(angle) * inner}
                y1={100 + Math.sin(angle) * inner}
                x2={100 + Math.cos(angle) * outer}
                y2={100 + Math.sin(angle) * outer}
                stroke={active ? 'rgb(254 109 0 / 0.55)' : 'rgb(255 255 255 / 0.12)'}
                strokeWidth={i % 5 === 0 ? 1.2 : 0.8}
                strokeLinecap="round"
              />
            )
          })}

        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="#2D2D2D"
          strokeWidth={STROKE}
        />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
          className="score-arc"
          style={{ ['--ring-circumference' as string]: CIRCUMFERENCE }}
        />

        <text
          x="100"
          y="80"
          textAnchor="middle"
          className="fill-muted-foreground font-mono uppercase"
          fontSize="8.5"
          letterSpacing="1.6"
        >
          {label}
        </text>
        <text
          x="100"
          y="121"
          textAnchor="middle"
          className="fill-foreground font-sans"
          fontSize="50"
          fontWeight="600"
          letterSpacing="-2"
        >
          {value}
        </text>
        <text
          x="100"
          y="140"
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          fontSize="9"
        >
          {sublabel ?? `out of ${max}`}
        </text>
      </svg>
    </div>
  )
}
