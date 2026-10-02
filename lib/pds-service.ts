export type Row=Record<string,any>;
export type Store={prepare:(sql:string)=>{bind:(...args:any[])=>any;all:()=>Promise<any>;first:()=>Promise<any>;run:()=>Promise<any>},batch:(queries:any[])=>Promise<any[]>};
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
export function kstDate(iso=now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso))}
function str(v:any,label:string,max=200,required=true){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new Error(label+'을 확인해 주세요.');return v.trim()}
function date(v:any,required=false){if(!v&&!required)return null;const x=str(v,'날짜',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||new Date(x+'T00:00:00Z').toISOString().slice(0,10)!==x)throw new Error('올바른 날짜를 입력해 주세요.');return x}
function minutes(v:any,required=true){if((v===''||v==null)&&!required)return null;const n=Number(v);if(!Number.isInteger(n)||n<0||n>525600)throw new Error('시간은 0~525600분의 정수로 입력해 주세요.');return n}
function priority(v:any,required=true){if(!v&&!required)return null;if(!['high','medium','low'].includes(v))throw new Error('우선순위를 선택해 주세요.');return v}
function planInput(x:Row){const a=date(x.start_date,true),b=date(x.end_date,true);if(a!>b!)throw new Error('종료일은 시작일 이후여야 합니다.');return {title:str(x.title,'계획 제목'),start_date:a,end_date:b,priority:priority(x.priority),success:str(x.success,'성공 기준',2000),expected_minutes:minutes(x.expected_minutes),draft:0}}
function taskInput(x:Row){let tags=x.tags;if(typeof tags==='string')tags=tags.split(',').map((t:string)=>t.trim()).filter(Boolean);if(!Array.isArray(tags)||tags.length>12)throw new Error('태그는 12개 이하로 입력해 주세요.');return {title:str(x.title,'할 일'),due_date:date(x.due_date,true),priority:priority(x.priority),tags:JSON.stringify(tags.map(t=>str(t,'태그',30))),expected_minutes:minutes(x.expected_minutes)}}
const q=(db:Store,sql:string,...values:any[])=>db.prepare(sql).bind(...values);
async function rows(db:Store,table:string){return (await db.prepare('SELECT * FROM '+table).all()).results}
export async function snapshot(db:Store){const [plans,tasks,logs,completions,reflections,revisions]=await Promise.all(['plans','tasks','execution_logs','completions','reflections','plan_revisions'].map(t=>rows(db,t)));return {plans,tasks,logs,completions,reflections,revisions,today:kstDate(),timezone:'Asia/Seoul',unit:'minutes'}}
export function aggregate(data:Row,planId:string,from='',to=''){
 const tasks=data.tasks.filter((t:Row)=>!t.deleted_at&&t.plan_id===planId&&(!from||(t.due_date&&t.due_date>=from))&&(!to||(t.due_date&&t.due_date<=to)));
 const ids=new Set(tasks.map((t:Row)=>t.id));const logs=data.logs.filter((l:Row)=>ids.has(l.task_id));
 const done=tasks.filter((t:Row)=>t.status==='done');const delayed=tasks.filter((t:Row)=>t.status!=='done'&&t.due_date&&t.due_date<data.today);const blocked=tasks.filter((t:Row)=>logs.some((l:Row)=>l.task_id===t.id&&l.blocker.trim()!==''));
 const expected=tasks.reduce((s:number,t:Row)=>s+(t.expected_minutes??0),0),actual=logs.reduce((s:number,l:Row)=>s+l.actual_minutes,0);
 return {tasks,logs,done,delayed,blocked,expected,actual,difference:actual-expected,unknownEstimates:tasks.filter((t:Row)=>t.expected_minutes==null).length};
}
async function ensureTask(db:Store,taskId:string){const t=await q(db,'SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL',taskId).first();if(!t)throw new Error('할 일을 찾을 수 없습니다. 새로고침해 주세요.');return t}
function completionQueries(db:Store,taskId:string,at:string){return [q(db,'INSERT INTO completions(task_id,active,completed_at) VALUES (?,1,?) ON CONFLICT(task_id) DO UPDATE SET active=1, completed_at=excluded.completed_at WHERE completions.active=0',taskId,at),q(db,"UPDATE tasks SET status='done',updated_at=? WHERE id=? AND deleted_at IS NULL AND status<>'done'",at,taskId)]}
export async function mutate(db:Store,x:Row){const at=now();const action=str(x.action,'동작',40);let result:Row={};
 if(action==='bootstrap'){
  if(await q(db,'SELECT value FROM settings WHERE key=?','initial-import-v1').first())return {imported:false};
  const p={id:'provided-records-plan',title:'취업 준비와 ALEPH 학습 관리',start_date:null,end_date:null,priority:null,success:'',expected_minutes:null,draft:1,version:1,created_at:at,updated_at:at};
  const jobs=[q(db,'INSERT OR IGNORE INTO plans(id,title,draft,created_at,updated_at) VALUES (?,?,1,?,?)',p.id,p.title,at,at),q(db,'INSERT OR IGNORE INTO plan_revisions(id,plan_id,version,snapshot,created_at) VALUES (?,?,1,?,?)','initial-revision',p.id,JSON.stringify(p),at)];
  const given=[['provided-interview','SKT 공채 면접 준비','2026-10-01T18:30:00+09:00','2026-10-01T21:30:00+09:00',180,''],['provided-reading','면접 준비 독서','2026-10-01T21:40:00+09:00','2026-10-01T23:30:00+09:00',110,''],['provided-aleph5','ALEPH 과제 5 수행','2026-10-02T09:20:00+09:00','2026-10-02T09:57:00+09:00',37,'클로드와 GPT의 연결에서 좀 헤맸습니다.']];
  for(const [tid,title,start,end,actual,blocker] of given){jobs.push(q(db,"INSERT OR IGNORE INTO tasks(id,plan_id,title,status,created_at,updated_at) VALUES (?,?,?,'done',?,?)",tid,p.id,title,at,at),q(db,'INSERT OR IGNORE INTO execution_logs(id,task_id,request_key,started_at,ended_at,actual_minutes,blocker,created_at) VALUES (?,?,?,?,?,?,?,?)','log-'+tid,tid,'import-'+tid,new Date(start as string).toISOString(),new Date(end as string).toISOString(),actual,blocker,at),q(db,'INSERT OR IGNORE INTO completions(task_id,active,completed_at) VALUES (?,1,?)',tid,new Date(end as string).toISOString()))}
  jobs.push(q(db,'INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)','initial-import-v1',at));await db.batch(jobs);return {imported:true};
 }
 if(action==='plan-create'||action==='reflect'){
  const p=planInput(x),pid=str(x.id||id(),'계획 ID',100);const reflect=action==='reflect';let rid:string|null=null;
  if(reflect){rid=str(x.reflection_id||id(),'돌아보기 ID',100);str(x.insight,'개선점',2000);if(!await q(db,'SELECT id FROM plans WHERE id=?',x.source_plan_id).first())throw new Error('원래 계획이 없습니다.')}
  const snap={id:pid,...p,version:1,origin_reflection:rid,created_at:at,updated_at:at};
  const jobs=[q(db,'INSERT OR IGNORE INTO plans(id,title,start_date,end_date,priority,success,expected_minutes,draft,version,origin_reflection,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,1,?,?,?)',pid,p.title,p.start_date,p.end_date,p.priority,p.success,p.expected_minutes,rid,at,at),q(db,'INSERT OR IGNORE INTO plan_revisions(id,plan_id,version,snapshot,created_at) VALUES (?,?,1,?,?)','v1-'+pid,pid,JSON.stringify(snap),at)];
  if(reflect)jobs.push(q(db,'INSERT OR IGNORE INTO reflections(id,plan_id,insight,next_plan_id,created_at) VALUES (?,?,?,?,?)',rid,x.source_plan_id,str(x.insight,'개선점',2000),pid,at));
  await db.batch(jobs);result={id:pid};
 } else if(action==='plan-update'){
  const p=planInput(x),version=Number(x.version);const old=await q(db,'SELECT * FROM plans WHERE id=?',x.id).first();if(!old||old.version!==version)throw new Error('다른 곳에서 수정됐습니다. 새로고침 후 다시 확인해 주세요.');
  const snap={...old,...p,version:version+1,updated_at:at};
  const res=await db.batch([q(db,'INSERT INTO plan_revisions(id,plan_id,version,snapshot,created_at) SELECT ?,id,version+1,?,? FROM plans WHERE id=? AND version=?',id(),JSON.stringify(snap),at,x.id,version),q(db,'UPDATE plans SET title=?,start_date=?,end_date=?,priority=?,success=?,expected_minutes=?,draft=0,version=version+1,updated_at=? WHERE id=? AND version=?',p.title,p.start_date,p.end_date,p.priority,p.success,p.expected_minutes,at,x.id,version)]);
  if(res[1].meta.changes!==1)throw new Error('계획이 이미 변경됐습니다. 다시 불러와 주세요.');
 } else if(action==='task-create'){
  const t=taskInput(x);if(!await q(db,'SELECT id FROM plans WHERE id=?',x.plan_id).first())throw new Error('계획을 선택해 주세요.');
  const tid=str(x.id||id(),'할 일 ID',100);await q(db,'INSERT OR IGNORE INTO tasks(id,plan_id,title,due_date,priority,tags,expected_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',tid,x.plan_id,t.title,t.due_date,t.priority,t.tags,t.expected_minutes,at,at).run();result={id:tid};
 } else if(action==='task-update'){
  await ensureTask(db,x.id);const t=taskInput(x);await q(db,'UPDATE tasks SET title=?,due_date=?,priority=?,tags=?,expected_minutes=?,updated_at=? WHERE id=? AND deleted_at IS NULL',t.title,t.due_date,t.priority,t.tags,t.expected_minutes,at,x.id).run();
 } else if(action==='task-delete'){
  await ensureTask(db,x.id);await q(db,'UPDATE tasks SET deleted_at=?,updated_at=? WHERE id=?',at,at,x.id).run();
 } else if(action==='complete'){
  await ensureTask(db,x.id);await db.batch(completionQueries(db,x.id,at));
 } else if(action==='reopen'){
  await ensureTask(db,x.id);await db.batch([q(db,"UPDATE tasks SET status='open',updated_at=? WHERE id=?",at,x.id),q(db,'UPDATE completions SET active=0 WHERE task_id=?',x.id)]);
 } else if(action==='log'){
  await ensureTask(db,x.task_id);const start=str(x.started_at,'시작 시각',40),end=str(x.ended_at,'종료 시각',40);if(!/(Z|[+-]\d\d:\d\d)$/.test(start)||!/(Z|[+-]\d\d:\d\d)$/.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<Date.parse(start))throw new Error('시작·종료 시각과 시간대를 확인해 주세요.');
  const elapsed=(Date.parse(end)-Date.parse(start))/60000;const actual=minutes(x.actual_minutes);if(actual!>elapsed)throw new Error('실제 작업시간은 시작~종료 경과시간보다 길 수 없습니다.');
  const key=str(x.request_key,'중복 방지 키',100),blocker=str(x.blocker??'','막힌 이유',2000,false);const jobs=[q(db,'INSERT OR IGNORE INTO execution_logs(id,task_id,request_key,started_at,ended_at,actual_minutes,blocker,created_at) VALUES (?,?,?,?,?,?,?,?)',id(),x.task_id,key,new Date(start).toISOString(),new Date(end).toISOString(),actual,blocker==='없음'?'':blocker,at)];
  if(x.complete===true)jobs.push(...completionQueries(db,x.task_id,at));await db.batch(jobs);
 } else throw new Error('지원하지 않는 요청입니다.');
 return result;
}
