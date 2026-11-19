/** Synthetic provenance is a quarantine, not permission to treat test data as geography. */
export function syntheticRecord(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false
  const r=record as Record<string,unknown>
  // Any correction provenance fails closed, even malformed or a false marker.
  if (r.service_area_correction !== undefined || r.test_mode !== undefined || r.test_id !== undefined || r.fixture_kind !== undefined) return true
  const intake=r.intake_payload as Record<string,unknown>|undefined
  return [r.service_area,intake?.serviceArea].some(value=>typeof value==='string' && /^\s*SYNTHETIC\s+TEST\s*:/i.test(value))
}
const fields = new Set(['customer_name','customer_email','business_name','website','business_category','primary_city','primary_state','primary_service_area','main_services','terms_accepted','terms_accepted_at','assessment_id','payment.event_id','payment.checkout_session_id','payment.payment_reference','payment.paid_at'])
export function auditDiagnostic(input: unknown) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('INVALID_AUDIT')
  const r=input as Record<string,unknown>
  if(r.result!=='AUDIT_ONLY' || !Array.isArray(r.issues) || r.issues.length>100)throw new Error('INVALID_AUDIT')
  const issues=r.issues.map(issue=>{
    if(!issue || typeof issue!=='object' || Array.isArray(issue))throw new Error('INVALID_AUDIT')
    const {field,status}=issue
    if(!fields.has(field) || !['missing','wrong_type','invalid'].includes(status))throw new Error('INVALID_AUDIT')
    return {field:field as string,status:status as string}
  })
  return {event:'orangerank_audit',result:'AUDIT_ONLY',issue_count:issues.length,issues}
}
export function logAudit(input:unknown, log:(line:string)=>void=console.info) {
  if(process.env.VERCEL_ENV!=='preview')return
  try {log(JSON.stringify(auditDiagnostic(input)))} catch {try{log(JSON.stringify({event:'orangerank_audit',result:'AUDIT_UNVERIFIED',issue_count:null,issues:[]}))}catch{}}
}

/** Exact copies must agree; no trimming, coercion or identity selection at handoff. */
export function consistentIntake(record: unknown): boolean {
  if(!record || typeof record!=='object' || Array.isArray(record))return false
  const r=record as Record<string,unknown>
  // Legacy generic handoff has no second copy; Grok separately rejects missing original intake.
  if(r.intake_payload===undefined)return true
  const i=r.intake_payload
  if(!i || typeof i!=='object' || Array.isArray(i))return false
  const intake=i as Record<string,unknown>
  const location=r.primary_location as Record<string,unknown>|undefined
  const pairs: [unknown,unknown][]=[
    [r.business_name,intake.businessName],[r.customer_name,intake.customerName],
    [r.customer_email,intake.email],[r.website,intake.website],
    [r.business_category,intake.category],[location?.city,intake.city],
    [location?.state,intake.state],[r.primary_services,intake.services],
    [r.terms_accepted,intake.terms_accepted],[r.phone,intake.phone],
    [r.service_area,intake.serviceArea],[r.competitors_known,intake.competitors],
    [r.google_business_url,intake.googleUrl],[r.notes,intake.notes],
  ]
  if(pairs.some(([a,b])=>a!==b))return false
  const urls=Array.from({length:5},(_,n)=>intake[`url${n}`]).filter(Boolean)
  // Redis cjson represents an empty array as {} after payment serialization.
  if(urls.length===0 && r.additional_urls && typeof r.additional_urls==='object' && !Array.isArray(r.additional_urls) && Object.keys(r.additional_urls).length===0)return true
  return Array.isArray(r.additional_urls) && r.additional_urls.length===urls.length && r.additional_urls.every((url,n)=>url===urls[n])
}
