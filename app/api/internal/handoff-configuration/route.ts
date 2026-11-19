import {timingSafeEqual} from 'node:crypto'
import {receiverConfigurationCategory} from '@/lib/handoff/dispatch'
export const runtime='nodejs'
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store'}
 if(process.env.VERCEL_ENV!=='preview')return new Response(null,{status:404,headers})
 const secret=process.env.ORANGERANK_AUDIT_SECRET,supplied=request.headers.get('authorization')??''
 if(!secret || secret.length<32 || supplied.length>1024)return new Response(null,{status:401,headers})
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(supplied)
 if(expected.length!==actual.length || !timingSafeEqual(expected,actual))return new Response(null,{status:401,headers})
 return Response.json({category:receiverConfigurationCategory()},{headers})
}
