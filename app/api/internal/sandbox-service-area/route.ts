import { timingSafeEqual } from 'node:crypto'
import { store } from '@/lib/checkout/store'
import { correctionInput,correctTestServiceArea } from '@/lib/handoff/correction'
export const runtime='nodejs'
function reply(status:number,result:string){return Response.json({result},{status,headers:{'Cache-Control':'no-store'}})}
export async function POST(request:Request){
 if(process.env.VERCEL_ENV!=='preview' || !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))return reply(503,'DISABLED')
 const secret=process.env.ORANGERANK_SANDBOX_CORRECTION_SECRET
 const supplied=request.headers.get('authorization')??''
 if(!secret || secret.length<32 || supplied.length>1024 || secret===process.env.ORANGERANK_AUDIT_SECRET || secret===process.env.ORANGERANK_DISPATCH_SECRET)return reply(401,'UNAUTHORIZED')
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(supplied)
 if(expected.length!==actual.length || !timingSafeEqual(expected,actual))return reply(401,'UNAUTHORIZED')
 try{
  const text=await request.text();if(Buffer.byteLength(text)>1000)return reply(413,'INVALID_REQUEST')
  const value=correctionInput(JSON.parse(text));if(!value)return reply(400,'INVALID_REQUEST')
  const result=String(await correctTestServiceArea(store(false),value))
  const allowed=['MISSING','IDENTITY_MISMATCH','NOT_TEST_RECORD','INVALID_RECORD','ALREADY_CORRECTED','NOT_EMPTY','CORRECTED']
  if(!allowed.includes(result))return reply(503,'RETRY')
  return reply(result==='CORRECTED'||result==='ALREADY_CORRECTED'?200:409,result)
 }catch{return reply(503,'RETRY')}
}
