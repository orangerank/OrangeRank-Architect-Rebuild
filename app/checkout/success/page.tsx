import { PaymentStatus } from '@/components/intake/payment-status'
import Link from 'next/link'
import { Logo } from '@/components/site/logo'
export default function SuccessPage(){return <main className="mx-auto max-w-2xl px-5 py-20"><Link href="/" aria-label="OrangeRank home"><Logo /></Link><h1 className="mt-10 text-3xl font-semibold">Payment complete</h1><PaymentStatus /><Link href="/" className="mt-6 inline-block text-brand">Back to OrangeRank</Link></main>}
