import {type Store,type Row,snapshot,kstDate} from './pds-service.ts';
import {stmt,HttpError} from './auth-service.ts';
export const observationSpec={question:'할 일의 예상 시간을 정하는 규칙을 바꾸면, 하루 예상 시간과 실제 사용 시간의 차이가 줄어드는가?',metric:'하루 예상 시간 합계와 실제 사용 시간 합계의 절대 차이',unit:'분',timezone:'Asia/Seoul',week_start:'월요일',before:'1~2일차에는 작업 시작 전에 각 할 일의 예상 시간을 내 판단으로 정하고, 별도의 여유 시간을 더하지 않는다. 확정한 예상 시간은 실제 소요 시간을 본 뒤 덮어쓰지 않는다.',calculation:'작업 전 확정한 대상의 예상 시간 합계와 그날 실제 시간 합계의 절대 차이. 미완료 대상도 포함. 미작업 확인은 0분, 알 수 없는 값은 누락으로 두고 지표와 평균에서 제외하며 유효 일수를 표시. 같은 실행 ID는 한 번만 합산. 다른 ID의 중복은 원본 확인 후 정정 사유 기록. 큰 실제 값은 제외하지 않고 이유 기록. 중간 반올림 없이 평균만 소수 첫째 자리로 반올림. 자정을 넘기는 실행은 날짜별 분할 입력.'};
export async function observationSnapshot(db:Store,uid:string){return {rules:await stmt(db,'SELECT * FROM observation_rules WHERE user_id=?',uid).first(),days:(await stmt(db,'SELECT * FROM observations WHERE user_id=? ORDER BY ordinal',uid).all()).results,spec:observationSpec}}
export async function observe(db:Store,uid:string,x:Row){const at=new Date().toISOString(),today=kstDate(at),state=await observationSnapshot(db,uid),days:Row[]=state.days;
 if(x.action==='change'){
 if(days.length!==2||days.some(d=>!d.finished_at)||state.rules?.change_json)throw new HttpError(409,'2일차 마감 후, 3일차 시작 전에 한 번 변경해 주세요.');
 if(typeof x.rule!=='string'||!x.rule.trim()||x.rule.length>2000||typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>2000)throw new HttpError(400,'새 규칙과 이유를 입력해 주세요.');
 const change={rule:x.rule.trim(),reason:x.reason.trim(),at,day_ids:days.map(d=>d.id)};
 await stmt(db,'UPDATE observation_rules SET change_json=? WHERE user_id=? AND change_json IS NULL',JSON.stringify(change),uid).run();return {ok:true};
 }
 if(x.action==='start'){
 if(days.length>=5||days.some(d=>!d.finished_at)||days.some(d=>d.date===today))throw new HttpError(409,'하루에 한 번, 이전 관찰을 마친 뒤 시작해 주세요.');
 if(days.length===2&&!state.rules?.change_json)throw new HttpError(409,'3일차 전에 계획 규칙 변경을 먼저 기록해 주세요.');
 const data=await snapshot(db,uid);if(!Array.isArray(x.task_ids)||!x.task_ids.length)throw new HttpError(400,'관찰할 할 일을 선택해 주세요.');
 const selected=data.tasks.filter((t:Row)=>x.task_ids.includes(t.id)&&!t.deleted_at&&t.expected_minutes!=null);if(selected.length!==new Set(x.task_ids).size)throw new HttpError(400,'할 일과 예상 시간을 확인해 주세요.');
 if(data.logs.some((l:Row)=>x.task_ids.includes(l.task_id)&&kstDate(l.started_at)===today))throw new HttpError(409,'오늘 이미 실행 기록이 있는 할 일은 사전에 계획을 고정할 수 없습니다.');
 const baseline=selected.map((t:Row)=>({id:t.id,title:t.title,expected_minutes:t.expected_minutes})),expected=selected.reduce((s:number,t:Row)=>s+t.expected_minutes,0);
 await db.batch([stmt(db,'INSERT OR IGNORE INTO observation_rules(user_id,spec,created_at) VALUES (?,?,?)',uid,JSON.stringify(observationSpec),at),stmt(db,'INSERT INTO observations(id,user_id,date,ordinal,baseline,expected,started_at) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),uid,today,days.length+1,JSON.stringify(baseline),expected,at)]);return {ok:true};
 }
 if(x.action==='finish'){
 const day=days.find(d=>d.id===x.id&&!d.finished_at);if(!day||day.date!==today)throw new HttpError(409,'오늘 시작한 관찰만 당일 마감할 수 있습니다. 날짜를 소급하지 않습니다.');
 const data=await snapshot(db,uid),ids=new Set(JSON.parse(day.baseline).map((t:Row)=>t.id));
 const logs=data.logs.filter((l:Row)=>ids.has(l.task_id)&&(kstDate(l.started_at)===today||kstDate(l.ended_at)===today));
 if(logs.some((l:Row)=>kstDate(l.started_at)!==today||kstDate(l.ended_at)!==today||Date.parse(l.started_at)<Math.floor(Date.parse(day.started_at)/60000)*60000||Date.parse(l.ended_at)>Date.now()))throw new HttpError(400,'관찰 시작 이후의 기록인지 확인하고, 자정을 넘긴 실행은 날짜별로 나눠 주세요.');
 if(typeof x.note!=='string'||x.note.length>3000||!x.note.trim())throw new HttpError(400,'미작업·누락·중복·큰 값 확인 결과를 적어 주세요.');
 const actual=x.missing===true?null:logs.reduce((s:number,l:Row)=>s+l.actual_minutes,0);const metric=actual==null?null:Math.abs(actual-day.expected);
 await stmt(db,'UPDATE observations SET actual=?,metric=?,note=?,finished_at=? WHERE id=? AND user_id=? AND finished_at IS NULL',actual,metric,JSON.stringify({text:x.note,log_snapshot:logs,missing:x.missing===true}),at,day.id,uid).run();return {ok:true};
 }
 throw new HttpError(400,'지원하지 않는 요청입니다.');
}
