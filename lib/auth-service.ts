import {hash,compare} from 'bcryptjs';
import type {Store,Row} from './pds-service.ts';
export const SESSION_MS=12*60*60*1000;
export const COOKIE='__Host-pds_session';
export class HttpError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status}}
export const secureHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export const stmt=(db:Store,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export function token(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export function cookie(value:string,maxAge=SESSION_MS/1000){return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
export async function session(db:Store,r:Request){const value=r.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!value||!/^[a-f0-9]{64}$/.test(value))throw new HttpError(401,'로그인이 필요합니다.');const h=await digest(value);const s=await stmt(db,'SELECT s.*,u.username FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',h,new Date().toISOString()).first();if(!s)throw new HttpError(401,'로그인이 필요합니다.');return s}
export async function body(r:Request,limit=24000){if(r.headers.get('origin')!==new URL(r.url).origin||r.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'같은 사이트에서 다시 요청해 주세요.');if(!r.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'JSON 요청이 필요합니다.');const raw=await r.text();if(raw.length>limit)throw new HttpError(413,'입력 내용이 너무 큽니다.');let x;try{x=JSON.parse(raw)}catch{throw new HttpError(400,'입력을 확인해 주세요.')}if(!x||typeof x!=='object'||Array.isArray(x))throw new HttpError(400,'입력을 확인해 주세요.');return x}
function password(p:any){if(typeof p!=='string'||p.length<12||new TextEncoder().encode(p).length>72)throw new HttpError(400,'비밀번호는 12자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.');return p}
async function throttle(db:Store,key:string){const at=new Date(),reset=new Date(at.getTime()+15*60000).toISOString();await stmt(db,'INSERT INTO auth_limits(key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END',key,reset,at.toISOString(),at.toISOString()).run();const row=await stmt(db,'SELECT count FROM auth_limits WHERE key=?',key).first();if(row.count>20)throw new HttpError(429,'요청이 많습니다. 15분 후 다시 시도해 주세요.')}
export async function authAction(db:Store,r:Request,x:Row){const at=new Date().toISOString();
 if(x.action==='register'||x.action==='login'){
 const username=typeof x.username==='string'?x.username.toLowerCase().trim():'';
 await throttle(db,'user:'+await digest(username));await throttle(db,'ip:'+await digest(r.headers.get('cf-connecting-ip')||'shared'));
 const fail='아이디 또는 비밀번호를 확인해 주세요.';
 if(x.action==='register'){
 if(!/^[a-z0-9_-]{4,40}$/.test(username))throw new HttpError(400,'아이디는 영문 소문자·숫자·밑줄·하이픈 4~40자로 입력해 주세요.');
 const encoded=await hash(password(x.password),12);const uid=crypto.randomUUID();
 try{await stmt(db,'INSERT INTO auth_users(id,username,password_hash,created_at) VALUES (?,?,?,?)',uid,username,encoded,at).run()}catch{throw new HttpError(409,'가입할 수 없는 아이디입니다. 다른 아이디를 사용해 주세요.')}
 return {ok:true};
 }
 const u=await stmt(db,'SELECT * FROM auth_users WHERE username=?',username).first();
 // Same bcrypt work and message for an unknown ID and an incorrect password.
 const dummy='$2b$12$C6UzMDM.H6dfI/f/IKcEe.7Mh.BOElxeTojj5HtUaMMiRp13/O2Vu';
 const input=typeof x.password==='string'&&new TextEncoder().encode(x.password).length<=72?x.password:'';
 const valid=await compare(input,u?.password_hash||dummy);if(!u||!valid)throw new HttpError(401,fail);
 const value=token();await stmt(db,'INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)',await digest(value),u.id,new Date(Date.now()+SESSION_MS).toISOString(),at).run();
 return {ok:true,setCookie:cookie(value)};
 }
 const s=await session(db,r);
 if(x.action==='logout'){await stmt(db,'DELETE FROM auth_sessions WHERE token_hash=?',s.token_hash).run();return {ok:true,setCookie:cookie('',0)}}
 if(x.action==='password'||x.action==='delete-account'){
 const u=await stmt(db,'SELECT * FROM auth_users WHERE id=?',s.user_id).first();if(typeof x.current_password!=='string'||!await compare(x.current_password,u.password_hash))throw new HttpError(401,'현재 비밀번호를 확인해 주세요.');
 if(x.action==='password'){const encoded=await hash(password(x.new_password),12);await db.batch([stmt(db,'UPDATE auth_users SET password_hash=? WHERE id=?',encoded,s.user_id),stmt(db,'DELETE FROM auth_sessions WHERE user_id=?',s.user_id)]);return {ok:true,setCookie:cookie('',0)}}
 const taskQuery='SELECT t.id FROM tasks t JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?';const planQuery='SELECT id FROM plans WHERE owner_id=?';
 await db.batch([stmt(db,`DELETE FROM execution_logs WHERE task_id IN (${taskQuery})`,s.user_id),stmt(db,`DELETE FROM completions WHERE task_id IN (${taskQuery})`,s.user_id),stmt(db,`DELETE FROM tasks WHERE plan_id IN (${planQuery})`,s.user_id),stmt(db,`DELETE FROM plan_revisions WHERE plan_id IN (${planQuery})`,s.user_id),stmt(db,`DELETE FROM reflections WHERE plan_id IN (${planQuery})`,s.user_id),stmt(db,'DELETE FROM plans WHERE owner_id=?',s.user_id),stmt(db,'DELETE FROM settings WHERE key=?','user-import:'+s.user_id),stmt(db,'DELETE FROM auth_users WHERE id=?',s.user_id)]);
 return {ok:true,setCookie:cookie('',0)};
 }
 throw new HttpError(400,'지원하지 않는 요청입니다.');
}
export function errorResponse(e:unknown){const status=e instanceof HttpError?e.status:typeof(e as any)?.status==='number'?(e as any).status:400;const msg=e instanceof Error&&(/주세요|없습니다|입력|요청/.test(e.message))?e.message:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';return Response.json({error:msg},{status,headers:secureHeaders})}
