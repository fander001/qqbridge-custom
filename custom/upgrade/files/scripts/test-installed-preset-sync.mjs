import {resolveInstalledPreset} from '../custom/runtime/preset-sync.js';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {bridgeHarness} from './audit-bridge-harness.mjs';
let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++;};
const h=await bridgeHarness({files:{'dsh/agent-presets/qq-chat-v2/agent.cordis.yml':'source-persona'},
 globals:{renderPatch:(name)=>'rendered:'+name}});
try{
 const options={root:path.join(h.temp,'qq-bridge'),home:path.join(h.temp,'dsh-home')};
 const legacyPath=path.join(options.home,'.agent-presets','qq-chat-v2','agent.cordis.yml');
 eq(resolveInstalledPreset('qq-chat-v2',options),legacyPath);
 const standard=path.join(options.home,'plugins','qq-agent-presets','presets','qq-chat-v2.patch.yml');
 fs.mkdirSync(path.dirname(standard),{recursive:true});fs.writeFileSync(standard,'standard');
 eq(resolveInstalledPreset('qq-chat-v2',options),standard);
 const custom=path.join(h.temp,'plugins','qq-agent-presets','presets','qq-chat-v2.patch.yml');
 fs.mkdirSync(path.dirname(custom),{recursive:true});fs.writeFileSync(custom,'custom');
 eq(resolveInstalledPreset('qq-chat-v2',options),custom);
 const target=path.join(h.temp,'installed.patch.yml');fs.writeFileSync(target,'stale');
 let r=h.syncInstalledPreset('qq-chat-v2',target);eq(r.synced,true);eq(r.changed,true);
 eq(fs.readFileSync(target,'utf8'),'rendered:qq-chat-v2');
 r=h.syncInstalledPreset('qq-chat-v2',target);eq(r.synced,true);eq(r.changed,false);
 const legacy=path.join(h.temp,'agent.cordis.yml');fs.writeFileSync(legacy,'old');
 r=h.syncInstalledPreset('qq-chat-v2',legacy);eq(r.changed,true);eq(fs.readFileSync(legacy,'utf8'),'source-persona');
 r=h.syncInstalledPreset('qq-chat-v2',path.join(h.temp,'absent.yml'));eq(r.synced,false);eq(r.changed,false);
 assert.throws(()=>h.syncInstalledPreset('../bad',target));checks++;
}finally{await h.close();}
console.log('PASS installed preset sync checks:',checks);
