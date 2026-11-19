import { randomUUID } from 'node:crypto'
import { pending, parseIntake } from '../checkout/core'
import { grokPayload } from './grok'
import type { PaidRecord } from '../checkout/payments'

/** Pure offline contract construction: no environment, store, sender or endpoint. */
export function offlineValidationPayload() {
  const now=new Date('2026-10-09T12:00:00Z')
  const record=pending(parseIntake({businessName:'Offline Test Business',website:'https://example.com',customerName:'Offline Test',email:'offline-test@example.com',category:'Home services',city:'Austin',state:'Texas',services:'Test services',serviceArea:'Offline fixture region',terms_accepted:true}), 'OR-20261009-OFFLINE-TEST',randomUUID(),now,'https://example.com','price_offline') as PaidRecord
  Object.assign(record,{payment_ownership_verified:true,identity_review:'CLEAR'})
  record.payment_status='PAYMENT_CONFIRMED';record.current_status='PAYMENT_CONFIRMED'
  record.verified_payment={assessment_id:record.assessment_id,event_id:'evt_offline',checkout_session_id:'cs_test_offline',payment_reference:'pi_offline',amount:14900,currency:'usd',paid_at:now.toISOString(),confirmed_at:now.toISOString()}
  // Exercise real builder, then add non-receiver test envelope. Never persist this record.
  return Object.freeze({...grokPayload(record),test_id:`offline-${randomUUID()}`,test_mode:'offline_only' as const,instructions:'LOCAL MOCK ONLY. Never process as a real assessment. No execution, QA, delivery or external actions.'})
}
