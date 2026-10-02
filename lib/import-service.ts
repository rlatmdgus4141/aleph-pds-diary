import {type Store,type Row,snapshot} from './pds-service.ts';
import {stmt,HttpError} from './auth-service.ts';
export async function importRecords(db:Store,owner:string,data:Row){
 if((await snapshot(db,owner)).plans.length)throw new HttpError(409,'기록이 없는 새 계정에서만 가져올 수 있습니다.');
 const names=['plans','tasks','logs','completions','reflections','revisions'];
 if(data.schema_version!==2||names.some(n=>!Array.isArray(data[n])||data[n].length>1000))throw new HttpError(400,'과제 6 전체 내보내기 JSON을 선택해 주세요.');
 const ids=new Set<string>();for(const n of names.filter(n=>n!=='completions'))for(const row of data[n]){if(typeof row.id!=='string'||row.id.length>100||ids.has(row.id))throw new HttpError(400,'중복되거나 잘못된 ID가 있습니다.');ids.add(row.id)}
 const map=new Map([...ids].map(v=>[v,crypto.randomUUID()]));
 const remap=(v:any):any=>typeof v==='string'?(map.get(v)||v):Array.isArray(v)?v.map(remap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)])):v;
 const pids=new Set(data.plans.map((p:Row)=>p.id)),tids=new Set(data.tasks.map((t:Row)=>t.id));
 if(data.tasks.some((t:Row)=>!pids.has(t.plan_id))||data.logs.some((l:Row)=>!tids.has(l.task_id))||data.completions.some((c:Row)=>!tids.has(c.task_id))||data.revisions.some((r:Row)=>!pids.has(r.plan_id))||data.reflections.some((r:Row)=>!pids.has(r.plan_id)||!pids.has(r.next_plan_id)))throw new HttpError(400,'기록의 연결을 확인해 주세요.');
 const definitions:any={plans:['plans',['id','title','start_date','end_date','priority','success','expected_minutes','draft','version','origin_reflection','created_at','updated_at']],tasks:['tasks',['id','plan_id','title','due_date','priority','tags','expected_minutes','status','created_at','updated_at','deleted_at']],logs:['execution_logs',['id','task_id','request_key','started_at','ended_at','actual_minutes','blocker','created_at']],completions:['completions',['task_id','active','completed_at']],reflections:['reflections',['id','plan_id','insight','next_plan_id','created_at']],revisions:['plan_revisions',['id','plan_id','version','snapshot','created_at']]};
 const jobs=[stmt(db,'INSERT INTO settings(key,value) VALUES (?,?)','user-import:'+owner,new Date().toISOString())];
 for(const n of names){const [table,base]=definitions[n];for(const raw of data[n]){const row=remap(raw),cols=[...base];if(n==='plans'){cols.push('owner_id');row.owner_id=owner}if(n==='logs'){if(!Number.isInteger(row.actual_minutes)||row.actual_minutes<0||row.actual_minutes>525600)throw new HttpError(400,'실제 시간을 확인해 주세요.');row.request_key=owner+':import:'+row.id}if(n==='tasks'){JSON.parse(row.tags);if(!['open','done'].includes(row.status))throw new HttpError(400,'상태를 확인해 주세요.')}if(n==='revisions')row.snapshot=JSON.stringify(remap(JSON.parse(raw.snapshot)));jobs.push(stmt(db,`INSERT INTO ${table}(${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,...cols.map(k=>row[k]??null)))}}
 await db.batch(jobs);return {ok:true,plans:data.plans.length,tasks:data.tasks.length,logs:data.logs.length};
}
