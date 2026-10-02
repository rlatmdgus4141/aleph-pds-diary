import {database} from '@/lib/database';
import {mutate,snapshot,ownedTask,ownedPlan} from '@/lib/pds-service';
import {session,body,secureHeaders,errorResponse} from '@/lib/auth-service';
export async function GET(r:Request){try{const db=database(),s=await session(db,r);const u=new URL(r.url);if(u.searchParams.has('task_id'))return Response.json(await ownedTask(db,s.user_id,u.searchParams.get('task_id')!),{headers:secureHeaders});if(u.searchParams.has('plan_id'))return Response.json(await ownedPlan(db,s.user_id,u.searchParams.get('plan_id')!),{headers:secureHeaders});return Response.json(await snapshot(db,s.user_id),{headers:secureHeaders})}catch(e){return errorResponse(e)}}
export async function POST(r:Request){try{const db=database(),s=await session(db,r);const x=await body(r);return Response.json({ok:true,...await mutate(db,x,s.user_id)},{headers:secureHeaders})}catch(e){return errorResponse(e)}}
