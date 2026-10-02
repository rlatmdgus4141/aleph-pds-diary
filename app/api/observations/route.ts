import {database} from '@/lib/database';
import {session,body,secureHeaders,errorResponse} from '@/lib/auth-service';
import {observe,observationSnapshot} from '@/lib/observation-service';
export async function GET(r:Request){try{const db=database(),s=await session(db,r);return Response.json(await observationSnapshot(db,s.user_id),{headers:secureHeaders})}catch(e){return errorResponse(e)}}
export async function POST(r:Request){try{const db=database(),s=await session(db,r);return Response.json(await observe(db,s.user_id,await body(r)),{headers:secureHeaders})}catch(e){return errorResponse(e)}}
