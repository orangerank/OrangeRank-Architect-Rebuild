'use client'
import { useState } from 'react'
export function ResumeCheckout() {
 const [busy,setBusy]=useState(false); const [error,setError]=useState('')
 return <><button disabled={busy} className="mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50" onClick={async()=>{setBusy(true);setError('');try {const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume:true})});const data=await response.json();if(!response.ok)throw new Error(data.error);const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Checkout could not be verified.');window.location.assign(url.href)}catch(e){setError(e instanceof Error?e.message:'Please retry.');setBusy(false)}}}>{busy?'Opening checkout…':'Resume Checkout'}</button><p role="status" className="mt-4 text-sm text-muted-foreground">{error}</p></>
}
