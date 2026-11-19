import { cn } from '@/lib/utils'

type Tone = 'dark' | 'light'

const wordmarks = {
  dark: { src: '/brand/wordmark-on-black-tight.png', width: 1950, height: 412, background: '#000000' },
  light: { src: '/brand/wordmark-on-light-tight.png', width: 1430, height: 284, background: '#FFFFFF' },
} as const

/** Official icon. The black background is baked into the file, so the tile stays #000000. */
export function LogoMark({ className, tone = 'dark' }: { className?: string; tone?: Tone }) {
  return (
    <img
      src="/brand/icon-on-black-tight.png"
      alt=""
      width={961}
      height={943}
      className={cn('size-7 shrink-0 bg-black object-contain', tone === 'light' && 'bg-black', className)}
    />
  )
}

export function Logo({
  className,
  withTagline = false,
  tone = 'dark',
}: {
  className?: string
  withTagline?: boolean
  tone?: Tone
}) {
  const mark = wordmarks[tone]
  return (
    <span className={cn('inline-flex flex-col', className)} style={{ backgroundColor: mark.background }}>
      <img
        src={mark.src}
        alt="OrangeRank"
        width={mark.width}
        height={mark.height}
        className={withTagline ? 'h-10 w-auto' : 'h-8 w-auto'}
      />
      {withTagline && (
        <span
          className={cn(
            'mt-2 text-[11px] font-medium leading-snug',
            tone === 'light' ? 'text-black' : 'text-[#C8C8C8]',
          )}
        >
          Put the power of AI to work for you.
        </span>
      )}
    </span>
  )
}
