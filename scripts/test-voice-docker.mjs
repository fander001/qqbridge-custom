import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {bridgeHarness} from './audit-bridge-harness.mjs';
const key='group:456',name='\u6e05\u5531_\u65e5\u672c\u8a9e.silk';
const bytes=Buffer.from('#!SILK_V3 fixture audio bytes');
let mode='fail',requests=[];
const peer=async(url,init={})=>{
 const body=JSON.parse(init.body||'{}');
 if(String(url).endsWith('/get_msg'))return {ok:true,status:200,
  json:async()=>({status:'ok',retcode:0,data:{message:[{type:'record',data:{duration:3}}]}})};
 requests.push(body);
 if(mode==='throw')throw new Error('fixture connection failure');
 return {ok:true,status:200,json:async()=>mode==='fail'
  ?{status:'failed',retcode:1200,wording:'fixture file failure'}
  :{status:'ok',retcode:0,data:{message_id:9001}}};
};
const h=await bridgeHarness({config:{socialV2:{enabled:true,
 voice:{enabled:true,maxPerMinute:0,maxPerHour:0},
 groupObserver:{enabled:true,continuousReplies:true,conversationIdleMs:90000}}},
 globals:{fetch:peer}});
try{
 h.setMode('reserved2');h.setSelfIdentity('fixture','999');
 fs.mkdirSync(path.join(h.temp,'audio'),{recursive:true});
 fs.writeFileSync(path.join(h.temp,'audio',name),bytes);
 const e={user_id:321,self_id:999,message_id:1,sender:{nickname:'fixture'},
  message:[{type:'at',data:{qq:'999'}},{type:'text',data:{text:'sing'}}]};
 h.appendSocialV2Message(key,'fixture','sing','sing',false,false,1,[],321);
 h.noteGroupIncoming(key,e,'sing',false);
 await h.deliverPrompt(key,'',{wakeReason:'atMention@seq1'});
 const lease=h.groupTurns.get(key);assert.ok(lease);assert.equal(lease.sent,0);
 const windowBefore=h.groupWindows.get(key)?.expiresAt;
 await assert.rejects(()=>h.sendVoiceForV2(key,name),/fixture file failure/);
 assert.equal(lease.sent,0,'gateway rejection preserves group budget');
 assert.equal(h.groupWindows.get(key)?.expiresAt,windowBefore,'failed voice does not extend chat');
 mode='throw';await assert.rejects(()=>h.sendVoiceForV2(key,name),/fixture connection failure/);
 assert.equal(lease.sent,0,'transport failure preserves group budget');
 assert.equal(h.getSocialV2State(key).lastAiReplyAt,0);
 mode='ok';const sent=await h.sendVoiceForV2(key,name);
 assert.equal(sent.verification.confirmed,true);
 assert.equal(lease.sent,1,'one successful voice spends one group slot');
 for(const p of requests){
  const file=p.message[0].data.file;
  assert.match(file,/^base64:\/\//);
  assert.deepEqual(Buffer.from(file.slice(9),'base64'),bytes);
  assert.ok(!file.includes(h.temp),'host paths are never sent to gateway');
 }
 await h.sendToQQ(key,'text after voice');
 assert.equal(lease.sent,2,'text response remains available after failed voice attempts');
 lease.sent=h.cfg.socialV2.groupObserver.maxMessagesPerTurn||3;
 const before=requests.length;
 await assert.rejects(()=>h.sendVoiceForV2(key,name));
 assert.equal(requests.length,before,'group cap blocks before gateway call');
 lease.sent=0;
 const check=h.captureSendGuard(key,{deferCount:true});check();
 assert.equal(lease.sent,0);check.commit();check.commit();
 assert.equal(lease.sent,1,'deferred commit is idempotent');
 console.log('PASS voice Docker transfer, Unicode path, failed-send budget, success commit, group cap');
}finally{await h.close();}
const h2=await bridgeHarness({config:{socialV2:{groupObserver:{enabled:true,continuousReplies:false}}}});
try{
 h2.setMode('reserved2');h2.setSelfIdentity('fixture','999');
 await h2.deliverPrompt(key,'',{wakeReason:'atMention@seq1'});
 const lease=h2.groupTurns.get(key);assert.ok(lease);
 const deferred=h2.captureSendGuard(key,{deferCount:true});deferred();
 assert.equal(lease.sent,0);deferred.commit();assert.equal(lease.sent,1);
 assert.ok(lease.closeAt>0,'noncontinuous group close time is committed');
 const legacy=h2.captureSendGuard(key);legacy();assert.equal(lease.sent,2);
 console.log('PASS deferred and legacy guards in noncontinuous groups');
}finally{await h2.close();}
