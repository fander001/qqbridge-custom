import assert from 'node:assert/strict';import {bridgeHarness} from './audit-bridge-harness.mjs';import {mergeGroupPolicy,groupPolicyAllows,validateGroupPolicy,GROUP_POLICY_KEYS} from '../src/group-policy.js';import {validateControlSettings} from '../src/console-controls.js';
let count=0;const eq=(a,b,m)=>{assert.equal(a,b,m);count++;},ok=(a,m)=>{assert.ok(a,m);count++;};
for(const phase of ['peak','offPeak'])for(const key of GROUP_POLICY_KEYS){const reason={ownerAtMention:'ownerAtMention',memberAtMention:'atMention',quoteReply:'quoteReply',textWake:'nameMention',followup:'groupFollowup',ambientSampling:'probability',idleProactive:'proactiveCheck'}[key];eq(groupPolicyAllows({},phase,reason),phase==='offPeak'||key==='ownerAtMention');eq(groupPolicyAllows({},phase,reason,false),false);const p=mergeGroupPolicy();p[phase][key]=!p[phase][key];eq(groupPolicyAllows(p,phase,reason),p[phase][key]);}
for(const bad of [null,[],{night:{}},{peak:[]},{peak:{textWake:1}},{offPeak:{other:true}}]){assert.throws(()=>validateGroupPolicy(bad));count++;}
assert.throws(()=>validateControlSettings({groupChatEnabled:false,replyToOthersEnabled:true}));count++;
let now=Date.parse('2026-10-27T10:00:00+08:00');class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const math=Object.create(Math);math.random=()=>.01;
const config={autonomySchedule:{enabled:true,peakWindows:[['09:00','12:00'],['14:00','18:00']],peakWeekdays:[1,2,3,4,5],holidays:[]},socialV2:{enabled:true,groupObserver:{enabled:true,continuousReplies:true,conversationIdleMs:90000,sampleProbability:.05},wake:{batchWindowMs:1000,recommendedKeywords:['Sagiri']},proactive:{enabled:true}}};
const make=async()=>{const h=await bridgeHarness({config:structuredClone(config),globals:{Date:Clock,Math:math}});h.setMode('reserved2');h.setSelfIdentity('Sagiri','999');return h;};
const key='group:456',pk='private:123';let msgId=10;
const event=(uid=321,at=null,text='hello',quote=false)=>({user_id:uid,self_id:999,message_id:++msgId,message:[{type:'text',data:{text}},...(at?[{type:'at',data:{qq:at}}]:[]),...(quote?[{type:'reply',data:{id:'100'}}]:[])],sender:{nickname:'fixture'}});
{
 const h=await make();try{
  h.applyReplyMode('silent');eq(h.shouldBlockSilentReply(pk),false);eq(h.shouldBlockSilentReply(key),true);eq(h.groupWakeAllowed(key,'ownerAtMention'),false);
  await h.handleIncoming('group',456,event(123,'999'),h.cfg);eq(h.calls.prompts.length,0);eq(h.getSocialV2State(key).unread.length,0,'off owner mention not queued or buffered');
  await h.sendWakePromptV2(key,'ownerAtMention');eq(h.calls.prompts.length,0);
  await h.sendWakePromptV2(pk,'private');eq(h.calls.prompts.length,1,'owner private still works');
 }finally{await h.close();}
}
{
 const h=await make();try{
  const st=h.getSocialV2State(key);
  for(const e of [event(321,'999'),event(321,null,'Sagiri'),event(123,null,'Sagiri'),event(321,null,'ambient')])await h.handleIncoming('group',456,e,h.cfg);
  eq(st.unread.length,0,'blocked calls are not retained as deferred replies');eq(h.calls.prompts.length,0);
  for(const reason of ['atMention','quoteReply','nameMention','groupFollowup','probability','proactiveCheck','timeout','bootstrap','admin']){await h.sendWakePromptV2(key,reason);eq(h.calls.prompts.length,0,reason+' blocked at peak');}
  await h.handleIncoming('group',456,event(123,'999'),h.cfg);await new Promise(r=>setTimeout(r,1250));eq(h.calls.prompts.length,1,'owner real @ wakes');
  await h.sendToQQ(key,'owner response');const expires=h.groupWindows.get(key).expiresAt;now+=1000;
  await h.handleIncoming('group',456,event(321,'999'),h.cfg);await h.handleIncoming('group',456,event(123,null,'followup without @'),h.cfg);
  eq(h.groupWindows.get(key).expiresAt,expires,'blocked followups cannot extend conversation');eq(st.unread.length,1);eq(h.calls.sent.length,1);
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-27T19:00:00+08:00');const h=await make();try{
  const st=h.getSocialV2State(key),name=event(321,null,'Sagiri');eq(h.evaluateWakeTriggerV2(key,st,name,'group','Sagiri','Sagiri',false),'nameMention');
  h.cfg.groupPolicy={offPeak:{textWake:false}};eq(h.evaluateWakeTriggerV2(key,st,name,'group','Sagiri','Sagiri',false),null,'text switch cannot be bypassed by sampling');
  eq(h.evaluateWakeTriggerV2(key,st,event(),'group','hello','hello',false),'probability');
  h.cfg.groupPolicy.offPeak.ambientSampling=false;eq(h.evaluateWakeTriggerV2(key,st,event(),'group','hello','hello',false),null);eq(h.groupMessageAdmitted(key,event(),'hello',false),true,'idle reader may buffer context without model call');
  h.cfg.groupPolicy.offPeak.idleProactive=false;eq(h.groupMessageAdmitted(key,event(),'hello',false),false);
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-27T08:59:59+08:00');const h=await make();try{
  await h.ensureSession(pk);const privateId=h.state.sessions[pk];await h.deliverPrompt(key,'',{wakeReason:'atMention@seq1'});const old=h.state.sessions[key],token=h.getSocialV2State(key).agentToken,guard=h.captureSendGuard(key);now+=1001;assert.throws(guard);count++;h.reconcileGroupRestrictions();eq(h.state.sessions[key],undefined);ok(h.calls.cancelled.includes(old));ok(h.getSocialV2State(key).agentToken!==token);eq(h.state.sessions[pk],privateId);
 }finally{await h.close();}
}
{
 now=Date.parse('2026-10-27T08:59:59+08:00');const h=await make();try{
  await h.deliverPrompt(key,'',{wakeReason:'ownerAtMention@seq1'});const guard=h.captureSendGuard(key);now+=1001;guard();h.reconcileGroupRestrictions();ok(h.state.sessions[key],'owner @ remains allowed across peak transition');
 }finally{await h.close();}
}
console.log('PASS unified policy core checks:',count);
