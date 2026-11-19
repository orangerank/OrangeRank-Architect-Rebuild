import { cn } from '@/lib/utils'

type SectionHeadingProps = {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: 'left' | 'center'
  className?: string
  id?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  id,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex max-w-2xl flex-col gap-4',
        align === 'center' && 'mx-auto items-center text-center',
        className,
      )}
    >
      <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand">
        <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[44px] lg:leading-[1.1]"
      >
        {title}
      </h2>
      {description && (
        <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      )}
    </div>
  )
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8', className)}>{children}</div>
}
