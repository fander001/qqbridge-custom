#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),at=args.indexOf('--upstream');
if(at<0||!args[at+1])throw new Error('Usage: node scripts/build-custom-upgrade.mjs --upstream <reference-source>');
const upstream=fs.realpathSync(path.resolve(args[at+1]));
if(upstream===fs.realpathSync(root))throw new Error('Reference must be an untouched upstream source tree');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const canonicalText=data=>{const text=data.toString('utf8');return data.includes(0)||!Buffer.from(text).equals(data)?data:Buffer.from(text.replace(/\r\n/g,'\n'));};
const result=spawnSync('git',['--git-dir='+path.join(root,'.git'),'--work-tree='+root,'ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'});
if(result.status!==0)throw new Error('Cannot inventory local source: '+result.stderr);
const protectedFile=p=>p==='config.json'||p.startsWith('.private/')||p.startsWith('state/')||p.startsWith('roles/')||p.startsWith('node_modules/')||p.endsWith('-installation.json')||p==='INSTALLATION.json'||p==='INSTALLATION.md'||p==='.npmrc'||p.startsWith('.env')||p==='_snowluma-catalog.json';
const excluded=new Set(['README.md','config.example.json']);
const candidates=[...new Set(result.stdout.split('\0').filter(Boolean))].filter(p=>!p.startsWith('custom/upgrade/')&&!protectedFile(p)&&!excluded.has(p)).sort();
const output=path.join(root,'custom/upgrade');
fs.mkdirSync(output,{recursive:true});
const patchedFiles=[],overlays=[];let patch='';
for(const relative of candidates) {
  const current=path.join(root,relative);
  if(!fs.existsSync(current)||!fs.statSync(current).isFile())continue;
  const before=path.join(upstream,relative),data=fs.readFileSync(current);
  if(fs.existsSync(before)) {
    if(canonicalText(fs.readFileSync(before)).equals(canonicalText(data)))continue;
    const diff=spawnSync('git',['-c','core.autocrlf=false','diff','--no-index','--text','--no-ext-diff','--unified=3','--',before,current],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
    if(diff.status!==1)throw new Error('Cannot diff '+relative+': '+diff.stderr);
    let text=diff.stdout.replace(/^diff --git .+$/m,'diff --git a/'+relative+' b/'+relative);
    text=text.replace(/^--- .+$/m,'--- a/'+relative).replace(/^\+\+\+ .+$/m,'+++ b/'+relative);
    patch+=text;
    patchedFiles.push({path:relative,beforeSha256:sha(fs.readFileSync(before)),afterSha256:sha(canonicalText(data))});
  } else {
    const dest=path.join(output,'files',relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(current,dest);
    overlays.push({path:relative,sha256:sha(data),bytes:data.length});
  }
}
const patchSha256=sha(Buffer.from(patch));
const provenance=JSON.parse(fs.readFileSync(path.join(root,'PROVENANCE.json'),'utf8'));
const bundleId=sha(Buffer.from(JSON.stringify({patchSha256,overlays}))).slice(0,20);
fs.writeFileSync(path.join(output,'core.patch'),patch);
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({format:1,bundleId,upstream:provenance.upstream,patchSha256,patchedFiles,overlays,excludedMutableFiles:['config.json','roles/','state/','.env*','.npmrc','.private/'],notes:['README.md and config.example.json are not overwritten by the upgrade installer.','Unknown upstream versions require a successful patch and console-anchor preflight, followed by regression tests.']},null,2)+'\n');
fs.copyFileSync(path.join(root,'custom/upgrade-runner.mjs'),path.join(output,'apply.mjs'));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(output,'LICENSE'));
fs.copyFileSync(path.join(root,'NOTICE'),path.join(output,'NOTICE'));
fs.copyFileSync(path.join(root,'custom/upgrade-readme.md'),path.join(output,'README.md'));
fs.writeFileSync(path.join(output,'package.json'),JSON.stringify({name:'qqbridge-custom-upgrade',private:true,type:'module',license:'MIT'},null,2)+'\n');
console.log(JSON.stringify({bundleId,patchedFiles:patchedFiles.map(x=>x.path),overlayFiles:overlays.length,patchLines:patch.split('\n').length},null,2));
