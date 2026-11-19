import {timingSafeEqual} from 'node:crypto'
import {store} from '@/lib/checkout/store'
import {contractCRequest,dispatchContractC} from '@/lib/handoff/contract-c'
import {receiverConfiguration} from '@/lib/handoff/dispatch'
export const runtime='nodejs'
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'}
 const respond=(status:number,result:string)=>Response.json({result},{status,headers})
 if(process.env.VERCEL_ENV!=='preview'||process.env.ORANGERANK_STRIPE_MODE!=='test'||!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))return respond(503,'DISABLED')
 const secret=process.env.ORANGERANK_DISPATCH_SECRET,supplied=request.headers.get('authorization')??''
 if(!secret||secret.length<32||secret===process.env.ORANGERANK_AUDIT_SECRET||supplied.length>1024)return respond(401,'UNAUTHORIZED')
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(supplied)
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return respond(401,'UNAUTHORIZED')
 try{const text=await request.text();if(Buffer.byteLength(text)>256)return respond(400,'INVALID_REQUEST')
 let body:unknown;try{body=JSON.parse(text)}catch{return respond(400,'INVALID_REQUEST')}
 const decision=contractCRequest(body);if(decision!=='READY')return respond(400,decision)
 const requestBody=body as {assessment_id:string;intake_submission_id:string}
 const result=await dispatchContractC(store(false),requestBody.assessment_id,requestBody.intake_submission_id,receiverConfiguration())
 return respond(result==='TRANSPORT_ACCEPTED'?200:result==='PENDING_INTEGRATION'?503:409,result)
 }catch{return respond(409,'OUTCOME_UNKNOWN')}
}
