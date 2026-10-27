import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {applyUpgrade,safeDestination} from '../custom/upgrade/apply.mjs';
import {readCustomizedConsole,renderCustomizedConsole} from '../custom/console/render.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv.indexOf('--upstream');assert.ok(arg>0,'pass --upstream <reference-tree>');
const baseline=path.resolve(process.argv[arg+1]),bundle=path.join(root,'custom/upgrade');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'qqbridge-upgrade-test-'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function copyTree(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())copyTree(a,b);else if(e.isFile())fs.writeFileSync(b,fs.readFileSync(a));else throw new Error('Unexpected link in baseline');}}
const fresh=name=>{const dest=path.join(temp,name);copyTree(baseline,dest);return dest;};
console.log('Preparing isolated upgrade fixture');
const target=fresh('working');
console.log('Upgrade fixture ready');
try {
 for(const p of ['../config.json','config.json','roles/personal.md','.private/x','/tmp/x','src/../../config.json','src\\x','.env.local','.GIT/config','src/CON.txt'])
  assert.throws(()=>safeDestination(target,p));
 const config='{"privateMarker":"must stay unchanged"}\n';
 fs.writeFileSync(path.join(target,'config.json'),config);
 fs.mkdirSync(path.join(target,'roles'),{recursive:true});fs.writeFileSync(path.join(target,'roles/personal.md'),'unchanged-role');
 fs.mkdirSync(path.join(target,'state'),{recursive:true});fs.writeFileSync(path.join(target,'state/private.json'),'{"keep":true}');
 const protectedFiles=['config.json','roles/personal.md','state/private.json','README.md','config.example.json'];
 const before=Object.fromEntries(protectedFiles.map(p=>[p,hash(path.join(target,p))]));
 const bridgeBefore=hash(path.join(target,'src/bridge.js'));
 const checked=await applyUpgrade(bundle,target,{checkOnly:true});assert.equal(checked.checkOnly,true);
 assert.equal(hash(path.join(target,'src/bridge.js')),bridgeBefore);assert.equal(fs.existsSync(path.join(target,'.qqbridge-custom-state.json')),false);
 const applied=await applyUpgrade(bundle,target,{checkOnly:false});assert.equal(applied.applied,true);
 for(const p of protectedFiles)assert.equal(hash(path.join(target,p)),before[p],'preserve '+p);
 const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8'));
 for(const f of [...manifest.patchedFiles,...manifest.overlays])assert.equal(hash(path.join(target,f.path)),f.afterSha256??f.sha256,f.path);
 assert.equal(renderCustomizedConsole(fs.readFileSync(path.join(target,'public/console.html'),'utf8')),readCustomizedConsole());
 assert.equal((await applyUpgrade(bundle,target,{checkOnly:false})).alreadyApplied,true);
 fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
 for(const script of ['test-group-master-schedule.mjs','test-unified-group-policy.mjs','test-group-continuous90.mjs','test-console-controls-ui.mjs','test-custom-modules.mjs']) {
  const result=spawnSync(process.execPath,[path.join(target,'scripts',script)],{cwd:target,encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,script+'\n'+result.stdout+'\n'+result.stderr);console.log(result.stdout.trim());
 }
 const newer=fresh('compatible-newer');
 fs.appendFileSync(path.join(newer,'src/bridge.js'),'\n// unrelated upstream addition must survive\n');
 const newerUi=fs.readFileSync(path.join(newer,'public/console.html'),'utf8').replace('<title>','<title>Upstream update: ');
 fs.writeFileSync(path.join(newer,'public/console.html'),newerUi);
 await applyUpgrade(bundle,newer,{checkOnly:false});
 assert.ok(fs.readFileSync(path.join(newer,'src/bridge.js'),'utf8').includes('unrelated upstream addition must survive'));
 assert.ok(renderCustomizedConsole(fs.readFileSync(path.join(newer,'public/console.html'),'utf8')).includes('<title>Upstream update: '));
 const windows=fresh('crlf-upstream');
 for(const f of manifest.patchedFiles){const p=path.join(windows,f.path);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/\r?\n/g,'\r\n'));}
 await applyUpgrade(bundle,windows,{checkOnly:false});
 assert.equal(hash(path.join(windows,'src/bridge.js')),manifest.patchedFiles.find(f=>f.path==='src/bridge.js').afterSha256);
 const conflict=fresh('conflict');fs.writeFileSync(path.join(conflict,'.gitignore'),'deliberate incompatible edit\n');
 const conflictedBefore=hash(path.join(conflict,'src/bridge.js'));
 await assert.rejects(applyUpgrade(bundle,conflict,{checkOnly:false}),/patch conflict/);
 assert.equal(hash(path.join(conflict,'src/bridge.js')),conflictedBefore);
 assert.equal(fs.existsSync(path.join(conflict,'.qqbridge-custom-backups')),false);
 const uiConflict=fresh('ui-conflict');fs.writeFileSync(path.join(uiConflict,'public/console.html'),'<html>changed layout</html>');
 await assert.rejects(applyUpgrade(bundle,uiConflict,{checkOnly:false}),/anchor conflict/);
 assert.equal(hash(path.join(uiConflict,'src/bridge.js')),bridgeBefore);
 console.log('PASS upgrade preflight, exact baseline restoration, no-write conflicts, idempotence and config preservation');
} finally {
 assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));
 assert.ok(path.basename(temp).startsWith('qqbridge-upgrade-test-'));
 fs.rmSync(temp,{recursive:true,force:true});
}
