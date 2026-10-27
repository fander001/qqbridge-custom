const DAY=86400000,OFFSET=8*3600000;
const clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const MASTER_SCHEDULE_DEFAULTS=Object.freeze({enabled:false,start:'',end:'',timeZone:'Asia/Shanghai'});
export function normalizeMasterSchedule(value={}){return {...MASTER_SCHEDULE_DEFAULTS,...value,timeZone:'Asia/Shanghai'};}
export function validateMasterSchedulePatch(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid master schedule');const out={};
 for(const [k,v] of Object.entries(value)){
  if(k==='enabled'){if(typeof v!=='boolean')throw new Error('Invalid schedule enabled flag');}
  else if(k==='start'||k==='end'){if(typeof v!=='string'||(v!==''&&!clock.test(v)))throw new Error('Time must use HH:mm');}
  else if(k==='timeZone'){if(v!=='Asia/Shanghai')throw new Error('Only Beijing time is supported');}
  else throw new Error('Unknown master schedule setting: '+k);
  out[k]=v;
 }return out;
}
export function masterScheduleState(atMs,value={}){
 const s=normalizeMasterSchedule(value),ms=Number(atMs);
 const valid=Number.isFinite(ms)&&clock.test(s.start)&&clock.test(s.end)&&s.start!==s.end;
 const base={enabled:s.enabled===true,valid,timeZone:'Asia/Shanghai',start:s.start,end:s.end,crossMidnight:valid&&s.start>s.end,shouldOpen:null,nextTransitionAt:null,nextTransitionOpen:null};
 if(!base.enabled)return base;
 if(!valid)return {...base,shouldOpen:false,error:'Set different valid opening and closing times'};
 const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));const a=minutes(s.start),b=minutes(s.end);
 const local=((ms+OFFSET)%DAY+DAY)%DAY/60000;
 const open=a<b?local>=a&&local<b:local>=a||local<b;
 const day=Math.floor((ms+OFFSET)/DAY)*DAY-OFFSET;const events=[];
 for(let i=0;i<3;i++)for(const [minute,state] of [[a,true],[b,false]]){const when=day+i*DAY+minute*60000;if(when>ms)events.push({when,state});}
 events.sort((a,b)=>a.when-b.when);const next=events[0];
 return {...base,shouldOpen:open,nextTransitionAt:new Date(next.when).toISOString(),nextTransitionOpen:next.state};
}
