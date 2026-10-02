import {database} from '@/lib/database';
import {session,body,secureHeaders,errorResponse} from '@/lib/auth-service';
import {importRecords} from '@/lib/import-service';
export async function POST(r:Request){try{const db=database(),s=await session(db,r);return Response.json(await importRecords(db,s.user_id,await body(r,1500000)),{headers:secureHeaders})}catch(e){return errorResponse(e)}}
