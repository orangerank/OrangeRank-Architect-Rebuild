'use client'
import { useEffect } from 'react'

export function PaymentStatus() {
  useEffect(() => {
    let active = true
    let attempts = 0
    let timer = 0
    const again = () => { if (active && attempts++ < 4) timer = window.setTimeout(check, 2000) }
    const check = () => {
      fetch('/api/checkout/status', { cache: 'no-store' })
        .then(async response => {
          const data = await response.json().catch(() => null)
          if (!active || (response.ok && data?.payment === 'VERIFIED')) return
          if (response.ok || response.status === 503) again()
        })
        .catch(() => again())
    }
    check()
    return () => { active = false; window.clearTimeout(timer) }
  }, [])
  return <p className="mt-5 text-muted-foreground">You&apos;re all set. Our team is getting started on your report, and it&apos;ll arrive at the email you gave us.</p>
}
