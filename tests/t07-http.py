"""Disposable HTTP authorization checks against the selected T07 Site.
Passwords and cookie values live only in memory; output always redacts them.
"""
import json,secrets,urllib.request,urllib.error,datetime,pathlib,os
BASE=os.environ.get('T07_TEST_ORIGIN','https://plan-do-see-diary.rlatmdgus4141.chatgpt.site')
records=[];checks=[];accounts=[]
def scrub(obj):
 if isinstance(obj,dict):return {k:('[REDACTED]' if any(s in k.lower() for s in ['password','cookie','token']) else scrub(v)) for k,v in obj.items()}
 if isinstance(obj,list):return [scrub(v) for v in obj]
 return obj
def call(method,path,data=None,cookie='',extra=None):
 headers={'Content-Type':'application/json','Origin':BASE}
 if cookie:headers['Cookie']=cookie
 if extra:headers.update(extra)
 req=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
 try:r=urllib.request.urlopen(req,timeout=40)
 except urllib.error.HTTPError as e:r=e
 raw=r.read().decode();status=r.status
 try:body=json.loads(raw)
 except:body={'non_json':raw[:150]}
 setcookie=r.headers.get('Set-Cookie','');sessioncookie=next((v.split(';')[0] for v in r.headers.get_all('Set-Cookie',[]) if v.startswith('__Host-pds_session=')),'')
 records.append({'method':method,'path':path,'request_headers':scrub(headers),'request_body':scrub(data),'status':status,'response_body':scrub(body),'set_cookie':'[REDACTED]; '+setcookie.split(';',1)[1] if ';' in setcookie else '[absent]'})
 return status,body,sessioncookie

def check(name,fn):
 try:fn();checks.append({'name':name,'status':'PASS'})
 except Exception as e:checks.append({'name':name,'status':'FAIL','reason':str(e)});raise

def eq(a,b):
 assert a==b,f'expected {b}, got {a}'

try:
 check('Anonymous data endpoint denies access',lambda:eq(call('GET','/api/pds')[0],401))
 for letter in ['a','b']:
  account={'username':'verify_'+letter+'_'+secrets.token_hex(5),'password':secrets.token_urlsafe(24)};accounts.append(account)
  eq(call('POST','/api/auth',{'action':'register',**account})[0],200)
  status,_,c=call('POST','/api/auth',{'action':'login',**account});eq(status,200);assert c;account['cookie']=c
  status,d,_=call('GET','/api/pds',cookie=c);eq(status,200);eq(len(d['plans']),0)
  pid='http-p-'+secrets.token_hex(12);tid='http-t-'+secrets.token_hex(12);account.update(pid=pid,tid=tid)
  plan={'action':'plan-create','id':pid,'title':'일회성 인증 검사 '+letter,'start_date':'2026-10-02','end_date':'2026-10-02','priority':'medium','success':'권한 검증 후 삭제','expected_minutes':10}
  eq(call('POST','/api/pds',plan,c)[0],200)
  task={'action':'task-create','id':tid,'plan_id':pid,'title':'테스트 '+letter,'due_date':'2026-10-02','priority':'medium','tags':['검사용'],'expected_minutes':10}
  eq(call('POST','/api/pds',task,c)[0],200)
 checks.append({'name':'Two new accounts register/login, start empty, create own records','status':'PASS'})
 for i in [0,1]:
  me=accounts[i];other=accounts[1-i];c=me['cookie'];tid=other['tid']
  before=call('GET','/api/pds',cookie=other['cookie'])[1]
  eq(call('GET','/api/pds?task_id='+me['tid'],cookie=c)[0],200)
  eq(call('GET','/api/pds?task_id='+tid,cookie=c)[0],404)
  update={'action':'task-update','id':tid,'title':'거절돼야 함','due_date':'2026-10-02','priority':'medium','tags':[],'expected_minutes':5}
  eq(call('POST','/api/pds',update,c)[0],404)
  eq(call('POST','/api/pds',{'action':'task-delete','id':tid},c)[0],404)
  after=call('GET','/api/pds',cookie=other['cookie'])[1];eq(before,after)
  status,own,_=call('GET','/api/pds?user_id='+other['username'],cookie=c,extra={'X-User-Id':other['username']});eq(status,200);eq([t['id'] for t in own['tasks']],[me['tid']])
  eq(call('POST','/api/pds',{'action':'task-update','id':me['tid'],'title':'내 기록 수정','due_date':'2026-10-02','priority':'medium','tags':[],'expected_minutes':11,'owner_id':other['username']},c)[0],200)
  checks.append({'name':f'Direction {i+1}: own read/update success; cross-owner read/update/delete 404; unchanged victim; spoofed URL/header/body ignored','status':'PASS'})
 me=accounts[0];c=me['cookie']
 eq(call('POST','/api/pds',{'action':'complete','id':me['tid']},c)[0],200);eq(call('POST','/api/pds',{'action':'complete','id':me['tid']},c)[0],200)
 d=call('GET','/api/pds',cookie=c)[1];eq(len(d['completions']),1)
 checks.append({'name':'Repeat completion leaves one completion row','status':'PASS'})
 eq(call('GET','/api/pds',cookie=c)[0],200);eq(call('POST','/api/auth',{'action':'logout'},c)[0],200);eq(call('GET','/api/pds',cookie=c)[0],401)
 checks.append({'name':'Same GET URL and same cookie: 200 before logout, 401 after server revocation','status':'PASS'})
 me=accounts[1];old=me['cookie'];newpass=secrets.token_urlsafe(24)
 eq(call('POST','/api/auth',{'action':'password','current_password':me['password'],'new_password':newpass},old)[0],200);me['password']=newpass
 eq(call('GET','/api/pds',cookie=old)[0],401)
 checks.append({'name':'Password change invalidates previous session','status':'PASS'})
 d1=call('POST','/api/auth',{'action':'login','username':accounts[0]['username'],'password':'wrong'})
 d2=call('POST','/api/auth',{'action':'login','username':'unknown_'+secrets.token_hex(4),'password':'wrong'})
 eq(d1[0],401);eq(d1[1],d2[1]);checks.append({'name':'Unknown username and wrong password share same response','status':'PASS'})
except Exception as e:
 checks.append({'name':'HTTP sequence','status':'FAIL','reason':str(e)})
finally:
 for account in accounts:
  try:
   st,_,c=call('POST','/api/auth',{'action':'login','username':account['username'],'password':account['password']})
   if st==200:
    st,_,_=call('POST','/api/auth',{'action':'delete-account','current_password':account['password']},c);eq(st,200)
    eq(call('GET','/api/pds',cookie=c)[0],401)
    checks.append({'name':'Disposable account and linked data deleted: '+account['username'],'status':'PASS'})
   else:checks.append({'name':'Cleanup login','status':'FAIL','username':account['username']})
  except Exception as e:checks.append({'name':'Cleanup','status':'FAIL','reason':str(e),'username':account['username']})
 report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':'HTTP integration requests to '+BASE+'; disposable fixtures, not real observation days; no browser UI test','checks':checks,'passed':sum(c['status']=='PASS' for c in checks),'total':len(checks),'records':records}
 pathlib.Path('t07/http-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps({'passed':report['passed'],'total':report['total'],'failures':[c for c in checks if c['status']!='PASS']},ensure_ascii=False))
 if report['passed']!=report['total']:raise SystemExit(1)
