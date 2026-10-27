import assert from 'node:assert/strict';import fs from 'node:fs';import {bridgeHarness} from './audit-bridge-harness.mjs';import {mergeGroupPolicy} from '../src/group-policy.js';
let checks=0;const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};const ok=(a,m)=>{assert.ok(a,m);checks++;};
const h=await bridgeHarness({config:{autonomySchedule:{enabled:true,peakWindows:[['09:00','12:00'],['14:00','18:00']],peakWeekdays:[1,2,3,4,5],holidays:['2026-10-01'],verifiedHolidayYears:[2026]},socialV2:{enabled:true,groupObserver:{enabled:true,continuousReplies:true,conversationIdleMs:90000,autonomousCooldownMs:120000,sampleProbability:.05},proactive:{enabled:true,checkIntervalMinMs:1800000,checkIntervalMaxMs:5400000,idleThresholdMs:900000,probability:.3}}}});h.setMode('reserved2');const server=h.startConsoleServer();
try{
 if(!server.listening)await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const req=async(body,token='fixture-console-token')=>{const r=await fetch(base+'/api/control-settings',{method:body?'POST':'GET',headers:{'content-type':'application/json','x-console-token':token},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};};
 let r=await req();eq(r.status,200);eq(r.groupChatEnabled,true);eq(r.groupPolicy.peak.ownerAtMention,true);eq(r.groupPolicy.peak.memberAtMention,false);eq(r.groupPolicy.offPeak.memberAtMention,true);eq(r.deferredReplies.supported,false);
 const original=fs.readFileSync(h.temp+'/config.json','utf8');
 for(const bad of [{groupPolicy:{peak:{textWake:1}}},{groupChatEnabled:'false'},{groupPolicy:{foo:{}}},{proactive:{checkIntervalMinMs:5400001,checkIntervalMaxMs:1800000}},{proactive:{probability:2}},{groupChatEnabled:false,replyToOthersEnabled:true}]){r=await req(bad);eq(r.status,400);eq(fs.readFileSync(h.temp+'/config.json','utf8'),original,'invalid body is atomic');}
 await h.ensureSession('private:123');const ownerId=h.state.sessions['private:123'];await h.deliverPrompt('group:456','',{wakeReason:'ownerAtMention'});const oldId=h.state.sessions['group:456'],token=h.getSocialV2State('group:456').agentToken;
 r=await req({groupPolicy:{peak:{textWake:true},offPeak:{memberAtMention:false}}});eq(r.status,200);eq(h.cfg.groupPolicy.peak.textWake,true);eq(h.cfg.groupPolicy.offPeak.memberAtMention,false);eq(h.cfg.groupPolicy.offPeak.idleProactive,true);eq(h.state.sessions['private:123'],ownerId);eq(h.state.sessions['group:456'],undefined);ok(h.calls.cancelled.includes(oldId));ok(h.getSocialV2State('group:456').agentToken!==token);eq(h.cfg.socialV2.groupObserver.conversationIdleMs,90000);eq(h.cfg.autonomySchedule.holidays[0],'2026-10-01');
 r=await req({groupChatEnabled:false});eq(r.groupChatEnabled,false);eq(r.replyToOthersEnabled,false);eq(h.shouldBlockSilentReply('group:456'),true);eq(h.shouldBlockSilentReply('private:123'),false);
 r=await req({groupPolicy:{peak:{memberAtMention:true}}});eq(r.groupChatEnabled,false,'editing matrix never enables master');eq(h.groupWakeAllowed('group:456','ownerAtMention'),false);
 r=await req({replyToOthersEnabled:true});eq(r.groupChatEnabled,true,'legacy alias maps to same switch');
 r=await req({proactive:{checkIntervalMinMs:2400000,checkIntervalMaxMs:4800000,probability:.2}});eq(r.status,200);eq(h.cfg.socialV2.proactive.checkIntervalMinMs,2400000);eq(h.cfg.socialV2.proactive.idleThresholdMs,900000);eq(h.cfg.socialV2.proactive.enabled,true);
 r=await req({groupPolicy:mergeGroupPolicy(),groupChatEnabled:false});eq(r.status,200);eq(r.groupPolicy.peak.textWake,false);eq(r.groupPolicy.offPeak.memberAtMention,true);
 const st=h.getSocialV2State('group:456');r=await req({groupChatEnabled:true},st.agentToken);eq(r.status,401);eq((await req()).groupChatEnabled,false);
 const unauthorized=await fetch(base+'/api/control-settings');eq(unauthorized.status,401);
 const status=await fetch(base+'/api/status',{headers:{'x-console-token':'fixture-console-token'}});const value=await status.json();eq(value.effectiveGroupPolicy.enabled,false);
}finally{await new Promise(r=>server.close(r));await h.close();}
console.log('PASS unified controls API checks:',checks);
