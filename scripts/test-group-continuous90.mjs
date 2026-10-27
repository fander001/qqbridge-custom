import assert from 'node:assert/strict';import {bridgeHarness} from './audit-bridge-harness.mjs';
let now=Date.parse('2026-10-26T19:00:00+08:00');
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const config={autonomySchedule:{enabled:true,holidays:[],verifiedHolidayYears:[2026]},
 socialV2:{enabled:true,groupObserver:{enabled:true,continuousReplies:true,conversationIdleMs:90000,sampleProbability:0,followupQuietMs:2000},
 wake:{batchWindowMs:1000,recommendedKeywords:['Sagiri','fixture-name'],maxWakePerMinute:3,maxWakePerHour:12}}};
const make=async()=>{const h=await bridgeHarness({config:structuredClone(config),globals:{Date:Clock}});h.setMode('reserved2');h.setSelfIdentity('Sagiri','999');return h;};
const key='group:456',event=(uid=321,at=null,text='hello')=>({user_id:uid,self_id:999,message_id:Date.now(),message:[{type:'text',data:{text}},...(at?[{type:'at',data:{qq:at}}]:[])],sender:{nickname:'fixture'}});
const pause=()=>new Promise(r=>setTimeout(r,140));
let checks=0;const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};const ok=(a,m)=>{assert.ok(a,m);checks++;};
function incoming(h,e,quoteSelf=false){const st=h.getSocialV2State(key);const text=e.message.find(s=>s.type==='text').data.text;h.appendSocialV2Message(key,'fixture',text,text,quoteSelf,e.user_id===123,1,[],e.user_id);h.noteGroupIncoming(key,e,text,quoteSelf);return st.lastUnreadSeq;}
async function engaged(h){const e=event(321,'999');incoming(h,e);await h.deliverPrompt(key,'',{wakeReason:'atMention@seq1'});await h.sendToQQ(key,'hello');return h.groupTurns.get(key);}
{
 const h=await make();try{
  const lease=await engaged(h);const original=now;
  eq(h.groupObservationRemaining(key),90000);
  let settled=false;const waiting=h.waitGroupConversation(key,{purpose:'messages'},{markSeen:true}).then(x=>{settled=true;return x;});
  now=original+15001;await h.maintainGroupObserver();await pause();
  eq(lease.closed,false,'not stopped after 15 seconds');eq(settled,false,'still listening');
  now=original+89999;await pause();eq(settled,false,'does not finish before 90 seconds');
  now=original+90000;await h.maintainGroupObserver();const result=await waiting;
  eq(result.canSleepNow,true);eq(result.waitedMs,90000);eq(result.newMessages.length,0);
  assert.throws(h.captureSendGuard(key));checks++;
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();try{
  const lease=await engaged(h);const w=h.groupWindows.get(key),expires=w.expiresAt;
  now+=30000;const other=event(444,null,'ambient');incoming(h,other);
  eq(w.expiresAt,expires,'unrelated speaker does not reset the clock');
  eq(h.evaluateWakeTriggerV2(key,h.getSocialV2State(key),other,'group','ambient','ambient',false),null);
  const elsewhere=event(321,'777','talking to another person');incoming(h,elsewhere);
  eq(w.expiresAt,expires,'mention addressed elsewhere is not a continuation');
  const follow=event(321,null,'continuing');const seq=incoming(h,follow);
  eq(h.evaluateWakeTriggerV2(key,h.getSocialV2State(key),follow,'group','continuing','continuing',false),'groupFollowup');
  eq(w.expiresAt,now+90000,'related reply restarts the rolling window');
  const wait=h.waitGroupConversation(key,{purpose:'messages'},{markSeen:true});now+=2100;
  const result=await wait;
  eq(result.arrived,true);ok(result.focusMessageSeqs.includes(seq));eq(result.canSleepNow,false);
  eq(result.readThroughSeq,seq,'context is delivered without skipping unread watermarks');
  h.getSocialV2State(key).pendingWakeReasons=[{reason:'groupFollowup@seq'+seq,seq}];
  eq(h.replayPendingWakeReasonsV2(key),null,'consumed live reply is not replayed');
  await h.sendToQQ(key,'one');await h.sendToQQ(key,'two');await h.sendToQQ(key,'three');
  const sent=h.calls.sent.length;await h.sendToQQ(key,'four');eq(h.calls.sent.length,sent,'one reply budget is three');
  incoming(h,event(321,null,'next reply'));await h.sendToQQ(key,'new response');
  eq(h.calls.sent.length,sent+1,'new related message grants another response');
  eq(lease.closed,false,'conversation can continue across multiple replies');
 }finally{await h.close();}
}
for(const reason of ['ownerAtMention','atMention','nameMention']){
 now=Date.parse('2026-10-27T10:00:00+08:00');const h=await make();try{
  const st=h.getSocialV2State(key);st.wakeTimes=Array(200).fill(now-500);st.lastAiReplyAt=now;
  await h.sendWakePromptV2(key,reason);
  eq(h.calls.prompts.length,reason==='ownerAtMention'?1:0,reason+' obeys explicit peak policy');
  if(reason==='ownerAtMention')eq(h.autonomyWork.get(key).autonomous,false);
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-27T10:00:00+08:00');const h=await make();try{
  const st=h.getSocialV2State(key),call=event(321,null,'Sagiri hello');
  eq(h.evaluateWakeTriggerV2(key,st,call,'group','Sagiri hello','Sagiri hello',false),null);
  eq(h.autonomyWakeBlocked(key,'nameMention@seq4'),true);
  const missing=event(123,'999');delete missing.self_id;
  eq(h.evaluateWakeTriggerV2(key,st,missing,'group','hello','hello',false),'ownerAtMention','trusted self ID fallback');
  incoming(h,event(123,'999'));await h.deliverPrompt(key,'',{wakeReason:'ownerAtMention@seq1'});await h.sendToQQ(key,'owner reply');
  incoming(h,event(321,null,'continue'));eq(h.autonomyWakeBlocked(key,'groupFollowup'),true);
  const other=event(888,null,'ambient');eq(h.evaluateWakeTriggerV2(key,st,other,'group','ambient','ambient',false),null,'peak still blocks unsolicited roaming');
 }finally{await h.close();}
}
console.log('PASS continuous group checks:',checks);

{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();try{
  incoming(h,event(321,'999'));await h.deliverPrompt(key,'',{wakeReason:'atMention@seq1'});
  now+=1000;const seq=incoming(h,event(321,null,'arrived during first response'));
  await h.sendToQQ(key,'first response');const wait=h.waitGroupConversation(key,{purpose:'messages'},{markSeen:true});
  now+=2100;const r=await wait;ok(r.focusMessageSeqs.includes(seq),'reply arriving during model processing is not lost');
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();const server=h.startConsoleServer();
 try{
  if(!server.listening || !server.address()?.port)await new Promise(r=>server.once('listening',r));await engaged(h);
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(path,body)=>{const r=await fetch(base+path+'?token=fixture-console-token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
  let r=await post('/api/socialV2/wake-config',{key,config:{mode:'active',infinite:false,triggers:{anyMessage:true}}});
  eq(r.status,400,'active config cannot bypass conversation observation');eq(r.data.preSleepWaitRemainingMs,90000);
  r=await post('/api/socialV2/mark-read',{key});eq(r.status,400,'mark-read cannot prematurely end observation');
  const controller=new AbortController();
  const first=fetch(base+'/api/socialV2/wait?token=fixture-console-token',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({key,purpose:'messages',timeoutMs:90000}),signal:controller.signal}).catch(()=>null);
  await pause();r=await post('/api/socialV2/wait',{key,purpose:'messages'});
  eq(r.status,429,'one active group wait');
  controller.abort();await first;await pause();
  now+=1001; r=await post('/api/socialV2/wait',{key,purpose:'reply',quietMs:1000});
  // The fake clock has already been quiet enough after advancing below.
  ok(r.status===200,'cancelled wait releases its slot');
  now+=90001;
  r=await post('/api/socialV2/wake-config',{key,config:{mode:'diving',infinite:true}});
  eq(r.status,200,'idle observation allows closing');
  eq(h.getSocialV2State(key).wakeConfig.triggers.nameMention,true);
 }finally{server.closeAllConnections?.();await new Promise(r=>server.close(r));await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();try{
  await engaged(h);h.cfg.socialV2.tools.getUnread=false;h.cfg.socialV2.tools.getRecent=false;
  now+=1000;const seq=incoming(h,event(321,null,'hidden by tool flags'));
  const wait=h.waitGroupConversation(key,{purpose:'messages'},{markSeen:true});now+=90001;
  const r=await wait;eq(r.newMessages.length,0);eq(h.getSocialV2State(key).modelSeenSeqs.has(seq),false,'disabled buffers cannot advance receipts');
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();try{
  await engaged(h);const wait=h.waitGroupConversation(key,{purpose:'messages'},{markSeen:true});
  h.cfg.allow.groups=[];const r=await wait;eq(r.cancelled,true);eq(r.newMessages.length,0);
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();try{
  await engaged(h);const old=h.groupTurns.get(key);h.getSocialV2State(key).bootstrapSent=true;
  await h.handleIncoming('group',456,event(123,'999','owner priority'),h.cfg);
  ok(old.closed);ok(h.calls.cancelled.includes(old.sessionId),'owner mention preempts old nonowner turn');
  await new Promise(r=>setTimeout(r,1200));
  ok(h.calls.prompts.length>=2,'owner gets a new prompt promptly');
 }finally{await h.close();}
}
console.log('PASS continuous group total checks:',checks);

{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();try{
  const lease=await engaged(h);h.settleGroupObserver(key,lease,'turn-end');h.groupTurns.delete(key);
  ok(h.groupWindows.get(key)?.spoken,'background observation survives an early model turn end');
  const e=event(321,null,'followup without a new mention');incoming(h,e);
  eq(h.evaluateWakeTriggerV2(key,h.getSocialV2State(key),e,'group','followup','followup',false),'groupFollowup');
  await h.sendWakePromptV2(key,'groupFollowup');eq(h.calls.prompts.length,2,'background continuation starts a fresh response');
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');const h=await make();try{
  h.cfg.socialV2.wake.batchWindowMs=8000;h.cfg.socialV2.groupObserver.sampleProbability=1;
  const st=h.getSocialV2State(key);st.wakeConfig.batchWindowMs=8000;
  await h.handleIncoming('group',456,event(321,null,'ambient'),h.cfg);
  await h.handleIncoming('group',456,event(123,'999','owner quick wake'),h.cfg);
  await new Promise(r=>setTimeout(r,1200));
  eq(h.calls.prompts.length,1,'owner upgrade shortens the existing eight-second batch');
  ok(st.lastWakeReason.startsWith('ownerAtMention'));
 }finally{await h.close();}
}
console.log('PASS continuous group final checks:',checks);
