import assert from 'node:assert/strict';
import { bridgeHarness } from './audit-bridge-harness.mjs';
let now=Date.parse('2026-10-26T10:00:00+08:00');
class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
const cfg={autonomySchedule:{enabled:true,holidays:[],verifiedHolidayYears:[2026]},socialV2:{enabled:true,wake:{batchWindowMs:1000}},allow:{private:['123'],groups:['456']}};
const make=async()=>{const h=await bridgeHarness({config:structuredClone(cfg),globals:{Date:Clock}});h.setMode('reserved2');return h;};
const event=(uid=123,at='999')=>({user_id:uid,self_id:999,message_id:1,message:[{type:'text',data:{text:'hello'}},...(at===null?[]:[{type:'at',data:{qq:at}}])],sender:{nickname:'fixture'}});
let checks=0;
{
 const h=await make();try {
  const st=h.getSocialV2State('group:456');st.wakeConfig.triggers={anyMessage:true,atMention:false};
  assert.equal(h.evaluateWakeTriggerV2('group:456',st,event(),'group','hello','hello',false),'ownerAtMention');checks++;
  assert.equal(h.evaluateWakeTriggerV2('group:456',st,event(321),'group','hello','hello',false),null);checks++;
  const fake=event(321);fake.sender.nickname='owner';
  assert.equal(h.evaluateWakeTriggerV2('group:456',st,fake,'group','hello','hello',false),null);checks++;
  assert.equal(h.evaluateWakeTriggerV2('group:456',st,event(123,'all'),'group','hello','hello',false),null);checks++;
  for(const reason of ['atMention','ownerAtMention','atMention@seq3','ownerAtMention@seq4']){
   assert.equal(h.autonomyWakeBlocked('group:456',reason),!reason.startsWith('ownerAtMention'));checks++;
  }
  assert.equal(h.autonomyWakeBlocked('private:123','private@seq3'),false);checks++;
  for(const reason of ['bootstrap','anyMessage','probability','question','nameMention','timeout','replyCheck','proactiveCheck']){
   assert.equal(h.autonomyWakeBlocked('group:456',reason),true,reason);checks++;
  }
  assert.ok(h.wakePriorityV2('ownerAtMention@seq4')>h.wakePriorityV2('atMention@seq3'));checks++;
  assert.equal(h.wakePriorityV2('atMention@seq3'),90);checks++;
  const p=h.buildWakePromptV2('group:456','atMention');
  assert.ok(p.includes('\u9009\u62e9\u56de\u5e94\u6216\u4e0d\u56de\u5e94'));checks++;
  assert.ok(p.includes('\u9ad8\u5cf0\u65f6\u6bb5'));checks++;
 }finally{await h.close();}
}
for(const [uid,reason] of [[123,'ownerAtMention'],[321,'atMention']]){
 const h=await make();try {
  await h.handleIncoming('group',456,event(uid),h.cfg);
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(h.calls.prompts.length,uid===123?1:0,'peak accepts only owner mention');checks++;
  if(uid===123){assert.equal(h.getSocialV2State('group:456').lastWakeReason,reason);checks++;}
 }finally{await h.close();}
}
{
 const h=await make();try {
  await h.handleIncoming('group',456,event(321,null),h.cfg);
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(h.calls.prompts.length,0,'unmentioned group bootstrap blocked at peak');checks++;
  await h.handleIncoming('group',789,event(),h.cfg);
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(h.calls.prompts.length,0,'unapproved group blocked even for owner');checks++;
 }finally{await h.close();}
}
{
 const h=await make();try {
  const st=h.getSocialV2State('group:456');st.wakeTimes=Array(12).fill(now-1000);
  await h.sendWakePromptV2('group:456','ownerAtMention');
  assert.equal(h.calls.prompts.length,1,'owner mention bypasses probabilistic wake cap');checks++;
  assert.equal(h.autonomyWork.get('group:456').autonomous,false);checks++;
 }finally{await h.close();}
}
{
 const h=await make();try {
  await h.deliverPrompt('group:456','',{wakeReason:'ownerAtMention'});const sid=h.state.sessions['group:456'];
  await h.maintainAutonomySchedule();assert.ok(!h.calls.cancelled.includes(sid));checks++;
  h.autonomyWork.set('group:456',{key:'group:456',wakeReason:'probability',autonomous:true,sessionId:sid,cancelled:false});
  await h.maintainAutonomySchedule();assert.ok(h.calls.cancelled.includes(sid));checks++;

 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T08:59:59+08:00');const h=await make();try {
  h.setReady(false);await h.deliverPrompt('group:456','queued direct',{wakeReason:'atMention'});
  now=Date.parse('2026-10-26T09:00:00+08:00');h.setReady(true);await h.flushQueue();
  assert.equal(h.calls.prompts.length,0,'queued nonowner direct reply denied across peak boundary');checks++;
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-26T08:59:59+08:00');const h=await make();try {
  h.setReady(false);await h.deliverPrompt('group:456','queued autonomy',{wakeReason:'anyMessage'});
  now=Date.parse('2026-10-26T09:00:00+08:00');h.setReady(true);await h.flushQueue();
  assert.equal(h.calls.prompts.length,0,'queued autonomous reply denied across peak boundary');checks++;
  now=Date.parse('2026-10-26T12:00:00+08:00');await h.maintainAutonomySchedule();
  assert.ok(h.getSocialV2State('group:456').proactiveTimer,'approved group resumes off-peak timer');checks++;
  assert.equal(h.calls.prompts.length,0,'resuming timers does not call the model');checks++;
 }finally{await h.close();}
}
console.log('PASS group participation checks:',checks);
