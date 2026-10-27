import assert from 'node:assert/strict';
import { bridgeHarness } from './audit-bridge-harness.mjs';
let now=Date.parse('2026-10-26T19:00:00+08:00');
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const config={autonomySchedule:{enabled:true,holidays:[],verifiedHolidayYears:[2026]},
 socialV2:{enabled:true,groupObserver:{enabled:true,sampleProbability:0},wake:{batchWindowMs:1000}}};
const make=async()=>{const h=await bridgeHarness({config:structuredClone(config),globals:{Date:Clock}});h.setMode('reserved2');return h;};
let checks=0;
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
const ok=(a,m)=>{assert.ok(a,m);checks++;};
const event=(uid=321,at=null)=>({user_id:uid,self_id:999,message_id:1,
 message:[{type:'text',data:{text:'how are you?'}},...(at?[{type:'at',data:{qq:at}}]:[])],sender:{nickname:'fixture'}});
{
 const h=await make();try{
  const key='group:456',st=h.getSocialV2State(key);
  st.wakeConfig.triggers={anyMessage:true,question:true,speakerIds:['321'],keywords:['how']};
  eq(h.evaluateWakeTriggerV2(key,st,event(),'group','how are you?','how are you?',false),null,'broad triggers cannot override observer');
  eq(h.evaluateWakeTriggerV2(key,st,event(123,'999'),'group','','',false),'ownerAtMention');
  eq(h.evaluateWakeTriggerV2(key,st,event(321,'999'),'group','','',false),'atMention');
  eq(h.evaluateWakeTriggerV2(key,st,event(321,'all'),'group','','',false),null,'at all is not owner at');
  await h.handleIncoming('group',456,event(),h.cfg);
  await new Promise(r=>setTimeout(r,1100));
  eq(h.calls.prompts.length,0,'no first unmentioned bootstrap');
  h.cfg.socialV2.groupObserver.sampleProbability=1;
  eq(h.evaluateWakeTriggerV2(key,st,event(),'group','','',false),'probability');
  const sid=await h.ensureSession(key);const lease=h.beginGroupTurn(key,'probability',sid);
  const guard=h.captureSendGuard(key);guard();guard();guard();
  assert.throws(guard);checks++;
  eq(lease.sent,3,'three real send reservations');
  eq(h.groupObserverBlocked(key,'probability'),true);
  eq(h.groupObserverBlocked(key,'ownerAtMention'),false);
  eq(h.groupObserverBlocked(key,'atMention'),false);
  h.autonomyWork.set(key,{autonomous:true,sessionId:sid,cancelled:false});
  now+=15001;await h.maintainGroupObserver();
  ok(h.calls.cancelled.includes(sid),'ends group after send grace');
  ok(h.autonomyWork.get(key).groupObserverClosed,'suppress cancellation notice');
  assert.throws(guard);checks++;
  eq(h.groupObserverBlocked('private:123','private'),false);
  h.groupTurns.delete(key);
  eq(h.groupObserverBlocked(key,'probability'),true,'cooldown persists after end');
  const next=h.beginGroupTurn(key,'ownerAtMention',sid);
  assert.throws(guard);checks++;
  const fresh=h.captureSendGuard(key);fresh();
  eq(next.owner,true);
  h.groupTurns.delete(key);
  now+=120001;eq(h.groupObserverBlocked(key,'probability'),false,'two minute cooldown expires');
  now=Date.parse('2026-10-27T10:00:00+08:00');
  eq(h.evaluateWakeTriggerV2(key,st,event(),'group','','',false),null,'peak forbids autonomy despite probability one');
  eq(h.autonomyWakeBlocked(key,'ownerAtMention'),false);
  const p=h.buildWakePromptV2(key,'ownerAtMention');
  ok(p.includes('两分钟')&&p.includes('群聊收尾优先'),'group prompt has observer rule');
  const privateSt=h.getSocialV2State('private:123');
  privateSt.lastIncomingAt=now;privateSt.lastAiReplyAt=now;
  eq(h.preSleepWaitBlockedV2(st,key),false);
  eq(h.preSleepWaitBlockedV2(privateSt,'private:123'),true,'private observation unchanged');
  const wake={triggers:{anyMessage:true,question:true}};
  h.applyGroupObserverWake(key,wake);
  eq(wake.mode,'diving');eq(wake.infinite,true);eq(wake.triggers.anyMessage,false);eq(wake.triggers.question,false);
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');
 const h=await make();try{
  const key='group:456';await h.deliverPrompt(key,'',{wakeReason:'probability'});
  eq(h.calls.prompts.length,1);
  const lease=h.groupTurns.get(key);
  ok(lease&&!lease.owner,'dispatch starts autonomous lease');
  const privateSid=await h.ensureSession('private:123');
  h.autonomyWork.set('private:123',{sessionId:privateSid,autonomous:false,cancelled:false});
  const st=h.getSocialV2State(key);st.bootstrapSent=true;
  await h.handleIncoming('group',456,event(123,'999'),h.cfg);
  ok(lease.closed,'owner at preempts autonomous turn');
  ok(h.calls.cancelled.includes(lease.sessionId));
  ok(!h.calls.cancelled.includes(privateSid),'private not stopped');
  ok(st.pendingWakeReasons.some(x=>x.reason==='ownerAtMention'),'owner event retained');
 }finally{await h.close();}
}
console.log('PASS group observer checks:',checks);

{
 now=Date.parse('2026-10-26T19:00:00+08:00');
 const h=await make();const server=h.startConsoleServer();
 try{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const key='group:456';await h.ensureSession(key);const st=h.getSocialV2State(key);
  h.appendSocialV2Message(key,{text:'new line',plain:'new line',userId:'321',time:now,isSelf:false});
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/socialV2/wait?token=fixture-console-token',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key,timeoutMs:300000,purpose:'messages'})});
  eq(response.status,200);
  const data=await response.json();
  eq(data.canSleepNow,true);eq(data.waitedMs,0);eq(data.newMessages.length,0,'wait does not inject followup messages');
  ok(st.unread.length>0,'wait does not acknowledge unseen messages');
  h.beginGroupTurn(key,'probability',h.state.sessions[key]);
  now+=90001;await h.maintainGroupObserver();
  eq(h.calls.cancelled.length,1,'silent autonomous turn also has hard deadline');
  const owner=h.beginGroupTurn(key,'ownerAtMention',h.state.sessions[key]);
  now+=90001;await h.maintainGroupObserver();eq(owner.closed,false,'owner gets larger processing budget');
  now+=90000;await h.maintainGroupObserver();eq(owner.closed,true,'owner turn also ends');
 }finally{await new Promise(r=>server.close(r));await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');
 const h=await make();try{
  const key='group:456';h.setReady(false);
  await h.deliverPrompt(key,'queued',{wakeReason:'probability'});
  h.getSocialV2State(key).lastAiReplyAt=now;
  h.setReady(true);await h.flushQueue();
  eq(h.calls.prompts.length,0,'cooldown checked again for queued autonomy');
  await h.deliverPrompt(key,'owner',{wakeReason:'ownerAtMention'});
  eq(h.calls.prompts.length,1,'owner bypasses cooldown at dispatch');
 }finally{await h.close();}
}
console.log('PASS group observer total checks:',checks);

{
 now=Date.parse('2026-10-26T19:00:00+08:00');
 const h=await make();try{
  const key='group:456';await h.deliverPrompt(key,'',{wakeReason:'probability'});
  for(const text of ['one','two','three','four']) await h.sendToQQ(key,text);
  eq(h.calls.sent.length,3,'actual outbound transport cannot exceed budget');
  const st=h.getSocialV2State(key);
  ok(st.lastAiReplyAt===now,'all outgoing types persist cooldown time');
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T19:00:00+08:00');
 const h=await make();try{
  const key='group:456';await h.deliverPrompt(key,'',{wakeReason:'proactiveCheck'});
  const old=h.groupTurns.get(key),st=h.getSocialV2State(key);st.bootstrapSent=false;
  await h.handleIncoming('group',456,event(123,'999'),h.cfg);
  ok(old.closed,'first ever owner mention also preempts proactive turn');
  ok(st.pendingWakeReasons.some(x=>x.reason==='ownerAtMention'));
 }finally{await h.close();}
}
{
 const h=await make();const server=h.startConsoleServer();
 try{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const key='group:456';const st=h.getSocialV2State(key);st.lastIncomingAt=now;
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/socialV2/wake-config?token=fixture-console-token',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({key,config:{mode:'active',infinite:false,triggers:{anyMessage:true,question:true,probability:1}}})});
  eq(response.status,200,'group closes without five minute observation');
  eq(st.wakeConfig.mode,'diving');eq(st.wakeConfig.infinite,true);
  eq(st.wakeConfig.triggers.anyMessage,false);eq(st.wakeConfig.triggers.question,false);
  eq(st.wakeConfig.triggers.probability,0,'AI cannot raise configured group sampling');
 }finally{await new Promise(r=>server.close(r));await h.close();}
}
console.log('PASS group observer final checks:',checks);
