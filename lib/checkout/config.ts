export const listAmount = 14900
export function stripeConfiguration(env: NodeJS.ProcessEnv=process.env) {
  const mode=env.ORANGERANK_STRIPE_MODE
  if(mode!=='test' && mode!=='live')throw Error('CONFIG')
  // Preview and local stay on test keys. Production may run sandbox keys first, then live keys after explicit approval.
  if(env.VERCEL_ENV!=='production' && mode!=='test')throw Error('CONFIG')
  if(mode==='live' && env.ORANGERANK_LIVE_APPROVED!=='true')throw Error('CONFIG')
  if(!env.STRIPE_SECRET_KEY?.startsWith(mode==='live'?'sk_live_':'sk_test_') || !env.STRIPE_ORANGERANK_PRICE_ID?.startsWith('price_'))throw Error('CONFIG')
  return {live:mode==='live',key:env.STRIPE_SECRET_KEY,price:env.STRIPE_ORANGERANK_PRICE_ID}
}
export function validPrice(p:{livemode:boolean;active:boolean;currency:string;unit_amount:number|null;type:string},live:boolean){return p.livemode===live && p.active && p.currency==='usd' && p.unit_amount===listAmount && p.type==='one_time'}
