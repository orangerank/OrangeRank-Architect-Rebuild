import Link from 'next/link'
import { Logo } from '@/components/site/logo'
import { ResumeCheckout } from '@/components/intake/resume-checkout'
export default function CancelPage(){return <main className="mx-auto max-w-2xl px-5 py-20"><Link href="/" aria-label="OrangeRank home"><Logo /></Link><h1 className="mt-10 text-3xl font-semibold">Checkout was not completed</h1><p className="mt-5 text-muted-foreground">Your intake remains saved. You can resume checkout in this browser. No payment has been confirmed and no assessment work has started.</p><ResumeCheckout /><Link href="/get-your-orange-score" className="mt-6 block text-brand">Return to intake</Link></main>}
