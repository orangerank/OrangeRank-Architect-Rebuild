import Link from 'next/link'
import { cn } from '@/lib/utils'

type CtaLinkProps = {
  href: string
  variant?: 'primary' | 'secondary'
  size?: 'md' | 'lg'
  className?: string
  children: React.ReactNode
}

export function CtaLink({ href, variant = 'primary', size = 'md', className, children }: CtaLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        size === 'md' ? 'h-10 px-5 text-sm' : 'h-12 px-6 text-[15px]',
        variant === 'primary' &&
          'bg-brand text-primary-foreground font-semibold shadow-[0_0_0_1px_rgb(254_127_4/0.45)_inset,0_8px_24px_-8px_rgb(254_109_0/0.55)] hover:bg-brand-light',
        variant === 'secondary' &&
          'border border-white/12 bg-white/[0.03] text-foreground hover:border-white/20 hover:bg-white/[0.06]',
        className,
      )}
    >
      {children}
    </Link>
  )
}
