import {NextRequest,NextResponse} from 'next/server'
import {store} from '@/lib/checkout/store'
import {customerStatus} from '@/lib/checkout/status'
export async function GET(request:NextRequest){
 const id=request.cookies.get('or_checkout')?.value
 const headers={'Cache-Control':'no-store'}
 if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:'Status unavailable.'},{status:401,headers})
 try{const redis=store(false);const raw=await redis.get<string>(`or:intake:${id}`);if(!raw)return NextResponse.json({error:'Status unavailable.'},{status:404,headers});const r=JSON.parse(raw);const job=await redis.get<string>(`or:handoff:${r.assessment_id}`);return NextResponse.json(customerStatus(r,job?JSON.parse(job):null),{headers})}catch{return NextResponse.json({error:'Status temporarily unavailable.'},{status:503,headers})}
}
