import assert from 'node:assert/strict';
import { autonomyScheduleState as state, nextAutonomyTransition } from '../src/autonomy-schedule.js';
import { bridgeHarness } from './audit-bridge-harness.mjs';
const schedule = { enabled: true, holidays: ['2026-10-01'], verifiedHolidayYears: [2026] };
const ms = text => Date.parse(text + '+08:00');
let count = 0;
for (const [time, expected] of [
 ['2026-10-26T08:59:59',true],['2026-10-26T09:00:00',false],
 ['2026-10-26T11:59:59',false],['2026-10-26T12:00:00',true],
 ['2026-10-26T13:59:59',true],['2026-10-26T14:00:00',false],
 ['2026-10-26T17:59:59',false],['2026-10-26T18:00:00',true],
 ['2026-10-31T10:00:00',true],['2026-11-01T15:00:00',true],
 ['2026-10-01T10:00:00',true],['2026-10-10T10:00:00',true],
 ['2027-02-08T10:00:00',false]]) {
 assert.equal(state(ms(time),schedule).allowed,expected,time); count++;
}
assert.equal(state(NaN,schedule).allowed,false);count++;
assert.equal(state(ms('2027-02-08T10:00:00'),schedule).calendarVerified,false);count++;
assert.equal(nextAutonomyTransition(ms('2026-10-26T08:59:59'),schedule),ms('2026-10-26T09:00:00'));count++;
assert.equal(nextAutonomyTransition(ms('2026-10-26T09:00:00'),schedule),ms('2026-10-26T12:00:00'));count++;
let now=ms('2026-10-26T10:00:00');
class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
const harness=()=>bridgeHarness({config:{autonomySchedule:schedule,socialV2:{enabled:true},allow:{private:['123'],groups:[]}},globals:{Date:Clock}});
for (const reason of ['proactiveCheck','timeout','replyCheck','bootstrap','admin']) {
 const h=await harness();try {h.setMode('reserved2');await h.sendWakePromptV2('private:123',reason);assert.equal(h.calls.prompts.length,0);count++;}finally{await h.close();}
}
{
 const h=await harness();try {
  h.setMode('reserved2');await h.sendWakePromptV2('private:123','private');
  assert.equal(h.calls.prompts.length,1,'owner reply must work at peak');count++;
 }finally{await h.close();}
}
{
 now=ms('2026-10-26T08:59:59');const h=await harness();try {
  h.setMode('reserved2');h.setReady(false);
  await h.deliverPrompt('private:123','queued autonomy',{wakeReason:'proactiveCheck'});
  now=ms('2026-10-26T09:00:00');h.setReady(true);await h.flushQueue();
  assert.equal(h.calls.prompts.length,0,'offline queue must recheck time');count++;
 }finally{await h.close();}
}
{
 now=ms('2026-10-26T08:59:59');const h=await harness();try {
  h.setMode('reserved2');
  h.autonomyWork.set('private:123',{autonomous:true,sessionId:'auto',cancelled:false});
  const guard=h.captureSendGuard('private:123');guard();
  now=ms('2026-10-26T09:00:00');
  assert.throws(guard);await h.maintainAutonomySchedule();
  assert.ok(h.calls.cancelled.includes('auto'));count++;
  h.autonomyWork.set('private:123',{autonomous:false,sessionId:'owner',cancelled:false});
  await h.maintainAutonomySchedule();h.captureSendGuard('private:123')();
  assert.ok(!h.calls.cancelled.includes('owner'));count++;
  now=ms('2026-10-26T12:00:00');await h.maintainAutonomySchedule();
  assert.ok(h.getSocialV2State('private:123').proactiveTimer,'resume owner opportunity timer');count++;
  assert.equal(h.calls.prompts.length,0,'clock alone does not consume model tokens');count++;
 }finally{await h.close();}
}
{
 now=ms('2026-10-26T10:00:00');const h=await harness();try {
  h.setMode('reserved2');h.cfg.socialV2.wake.batchWindowMs=1000;
  await h.handleIncoming('private',123,{user_id:123,self_id:999,message_id:1,message:[{type:'text',data:{text:'hello'}}]},h.cfg);
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(h.calls.prompts.length,1,'first owner private message at peak must wake as reply, not bootstrap');count++;
 }finally{await h.close();}
}
{
 now=ms('2026-10-26T10:00:00');const h=await harness();let server;try {
  h.setMode('reserved2');const st=h.getSocialV2State('private:123');
  h.autonomyWork.set('private:123',{autonomous:true,sessionId:'auto',cancelled:false});
  server=h.startConsoleServer();if(!server.listening)await new Promise(r=>server.once('listening',r));
  const headers={'x-console-token':'fixture-console-token','x-agent-call':'1','x-agent-token':st.agentToken};
  let response=await fetch('http://127.0.0.1:'+server.address().port+'/api/status',{headers});
  assert.equal(response.status,403);await response.text();count++;
  h.autonomyWork.set('private:123',{autonomous:false,sessionId:'owner',cancelled:false});
  response=await fetch('http://127.0.0.1:'+server.address().port+'/api/status',{headers});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.ownerQQ,undefined);count++;
 }finally{if(server)await new Promise(r=>server.close(r));await h.close();}
}
console.log('PASS autonomy schedule checks:',count);
