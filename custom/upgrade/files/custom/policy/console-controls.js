import { validateMasterSchedulePatch } from './group-master-schedule.js';
import { validateGroupPolicy } from './group-policy.js';
export const GROUP_CONTROL_DEFAULTS = Object.freeze({ enabled:false, autonomousCooldownMs:120000, sampleProbability:0.05, maxMessagesPerTurn:3, closeAfterSendMs:15000, maxTurnMs:90000, ownerMaxTurnMs:180000, continuousReplies:false, conversationIdleMs:90000, directWakeBatchMs:1500, ownerWakeBatchMs:1000, followupQuietMs:2000 });
const ranges = { autonomousCooldownMs:[0,3600000],sampleProbability:[0,1],maxMessagesPerTurn:[1,8],closeAfterSendMs:[1000,600000],maxTurnMs:[10000,600000],ownerMaxTurnMs:[10000,600000],conversationIdleMs:[1000,600000],directWakeBatchMs:[1000,8000],ownerWakeBatchMs:[1000,8000],followupQuietMs:[250,30000] };
const object = x => x && typeof x === 'object' && !Array.isArray(x);
export function validateControlSettings(body) {
 if(!object(body)) throw new Error('Expected settings object');
 const result={};
 if ('groupMasterSchedule' in body)result.groupMasterSchedule=validateMasterSchedulePatch(body.groupMasterSchedule);
 if ('groupPolicy' in body) result.groupPolicy=validateGroupPolicy(body.groupPolicy);
 if ('groupChatEnabled' in body) {
  if(typeof body.groupChatEnabled!=='boolean')throw new Error('Invalid group master switch');
  if('replyToOthersEnabled' in body && body.replyToOthersEnabled!==body.groupChatEnabled)throw new Error('Conflicting master switches');
  result.replyToOthersEnabled=body.groupChatEnabled;
 }
 if ('proactive' in body) {
  if(!object(body.proactive))throw new Error('Invalid proactive settings');const p={};
  const limits={checkIntervalMinMs:[60000,86400000],checkIntervalMaxMs:[60000,86400000],idleThresholdMs:[60000,86400000],probability:[0,1]};
  for(const [k,v] of Object.entries(body.proactive)){
   if(k==='enabled'){if(typeof v!=='boolean')throw new Error('Invalid proactive switch');}
   else {const r=limits[k];if(!r||typeof v!=='number'||!Number.isFinite(v)||v<r[0]||v>r[1]||(k!=='probability'&&!Number.isInteger(v)))throw new Error('Invalid proactive value: '+k);}
   p[k]=v;
  }result.proactive=p;
 }

 for(const k of Object.keys(body)) if(!['groupObserver','autonomySchedule','replyToOthersEnabled','groupChatEnabled','groupPolicy','proactive','groupMasterSchedule'].includes(k)) throw new Error('Unknown setting: '+k);
 if('replyToOthersEnabled' in body) {if(typeof body.replyToOthersEnabled!=='boolean') throw new Error('Invalid reply switch');result.replyToOthersEnabled=body.replyToOthersEnabled;}
 if('groupObserver' in body) {
  if(!object(body.groupObserver)) throw new Error('Invalid group settings');
  const g={};
  for(const [k,v] of Object.entries(body.groupObserver)) {
   if(['enabled','continuousReplies'].includes(k)) {if(typeof v!=='boolean') throw new Error('Invalid boolean: '+k);}
   else {const r=ranges[k];if(!r||typeof v!=='number'||!Number.isFinite(v)||v<r[0]||v>r[1]||(k!=='sampleProbability'&&!Number.isInteger(v))) throw new Error('Invalid number: '+k);}
   g[k]=v;
  }
  result.groupObserver=g;
 }
 if('autonomySchedule' in body) {
  const s=body.autonomySchedule;if(!object(s)) throw new Error('Invalid schedule');const out={};
  for(const k of Object.keys(s)) if(!['enabled','peakWindows','peakWeekdays'].includes(k)) throw new Error('Unknown schedule setting: '+k);
  if('enabled' in s){if(typeof s.enabled!=='boolean') throw new Error('Invalid schedule switch');out.enabled=s.enabled;}
  if('peakWeekdays' in s){if(!Array.isArray(s.peakWeekdays)||s.peakWeekdays.length>7||s.peakWeekdays.some(x=>!Number.isInteger(x)||x<1||x>7)||new Set(s.peakWeekdays).size!==s.peakWeekdays.length) throw new Error('Invalid weekdays');out.peakWeekdays=[...s.peakWeekdays].sort();}
  if('peakWindows' in s){const w=s.peakWindows;if(!Array.isArray(w)||w.length!==2||w.some(x=>!Array.isArray(x)||x.length!==2||x.some(t=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||x[0]>=x[1])||w[0][1]>w[1][0]) throw new Error('Invalid peak windows');out.peakWindows=w.map(x=>[...x]);}
  result.autonomySchedule=out;
 }
 return result;
}
