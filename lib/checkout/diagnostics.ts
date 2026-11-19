/** Temporary, Preview-only diagnostics. Never serialize exceptions or messages. */
export const stages = ['REQUEST_VALIDATION', 'ORIGIN_VERIFICATION', 'CHECKOUT_ENABLED_GUARD', 'INTAKE_VALIDATION', 'STRIPE_INITIALIZATION', 'STRIPE_PRICE_RETRIEVAL', 'REDIS_INITIALIZATION', 'REDIS_RATE_LIMIT', 'REDIS_ASSESSMENT_RESERVATION', 'PENDING_ASSESSMENT_WRITE', 'STRIPE_CHECKOUT_SESSION_CREATE', 'CHECKOUT_RESPONSE'] as const
export type CheckoutStage = typeof stages[number]
const types = new Set(['Error', 'TypeError', 'SyntaxError', 'RangeError', 'RedisError', 'UpstashError', 'StripeError', 'StripeAuthenticationError', 'StripeInvalidRequestError', 'StripeAPIError', 'StripeConnectionError', 'StripeRateLimitError', 'StripePermissionError', 'StripeIdempotencyError'])
const codes = new Set(['resource_missing', 'api_key_expired', 'parameter_missing', 'parameter_invalid_empty', 'parameter_unknown', 'rate_limit', 'idempotency_key_in_use', 'NOAUTH', 'WRONGPASS', 'NOPERM', 'CONFIG', 'STALE'])
function property(error: unknown, key: string): unknown {
  try { return error && typeof error === 'object' ? Reflect.get(error, key) : undefined } catch { return undefined }
}
export function sanitizedProviderError(error: unknown) {
  const type = property(error, 'type') ?? property(error, 'name')
  const code = property(error, 'code')
  return {error_type: typeof type === 'string' && types.has(type) ? type : 'UnknownError',
    ...(typeof code === 'string' && codes.has(code) ? {error_code: code} : {})}
}
export function checkoutDiagnostics() {
  let stage: CheckoutStage = 'CHECKOUT_ENABLED_GUARD'
  function emit(event: object) {
    if (process.env.VERCEL_ENV !== 'preview') return
    try { console.info(JSON.stringify(event)) } catch { /* Diagnostics must not change payment behavior. */ }
  }
  return {
    start(next: CheckoutStage) { stage = next },
    success(next: CheckoutStage = stage) { emit({ event: 'orangerank_checkout_stage', stage: next, timestamp: new Date().toISOString() }) },
    failure(error?: unknown, safeCode?: string) {
      const type = property(error, 'type') ?? property(error, 'name')
      const code = safeCode ?? property(error, 'code')
      emit({ event: 'orangerank_checkout_failure', stage,
        error_type: typeof type === 'string' && types.has(type) ? type : error === undefined ? 'CheckoutRejected' : 'UnknownError',
        ...(typeof code === 'string' && codes.has(code) ? { error_code: code } : {}), timestamp: new Date().toISOString() })
    },
  }
}
