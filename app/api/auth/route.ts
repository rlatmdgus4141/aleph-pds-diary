import {database} from '@/lib/database';
import {session,body,authAction,secureHeaders,errorResponse} from '@/lib/auth-service';
export async function GET(r:Request){try{const s=await session(database(),r);return Response.json({username:s.username,expires_at:s.expires_at},{headers:secureHeaders})}catch(e){return errorResponse(e)}}
export async function POST(r:Request){try{const result=await authAction(database(),r,await body(r));const {setCookie,...data}=result;return Response.json(data,{headers:{...secureHeaders,...(setCookie?{'Set-Cookie':setCookie}:{})}})}catch(e){return errorResponse(e)}}
