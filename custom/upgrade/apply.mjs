#!/usr/bin/env node
// Standalone local upgrader. Never starts QQ/DSH, installs packages, edits Git, or connects to a host.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const copyBytes = (from,to) => fs.writeFileSync(to,fs.readFileSync(from));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const here = path.dirname(fileURLToPath(import.meta.url));
const protectedRoot = new Set(['.git','.private','node_modules','roles','state','audio','config.json','.npmrc','.env','.credentials.yaml','.qqbridge-custom-backups','.qqbridge-custom-state.json']);
export function safeDestination(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0')
      || path.posix.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) throw new Error('Unsafe relative path: '+relative);
  const parts=relative.split('/');
  if(parts.some(p=>!p || p==='.' || p==='..' || p.endsWith('.') || p.endsWith(' ') || /[<>:"|?*\x00-\x1f]/.test(p))
      || parts.some(p=>/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))
      || protectedRoot.has(parts[0].toLowerCase()) || parts[0].toLowerCase().startsWith('.env.') || parts[0].endsWith('-installation.json'))
    throw new Error('Protected or unsafe path: '+relative);
  const target=path.resolve(root,...parts);
  if(!target.startsWith(path.resolve(root)+path.sep))throw new Error('Path escaped target: '+relative);
  let cursor=path.resolve(root);
  for(const part of parts) {
    cursor=path.join(cursor,part);
    if(fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink())throw new Error('Refusing symbolic link: '+relative);
  }
  return target;
}
function gitApply(scratch, patch, check) {
  const args=['-c','core.autocrlf=false','apply','--whitespace=nowarn',...(check?['--check']:[]),patch];
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^GIT_/i.test(key)));
  env.GIT_CEILING_DIRECTORIES=path.dirname(scratch);
  const result=spawnSync('git',args,{cwd:scratch,encoding:'utf8',env});
  if(result.error || result.status!==0)throw new Error('Core patch conflict; no target files changed.\n'+(result.error?.message ?? result.stderr));
}
function equalFile(file,hash){return fs.existsSync(file) && fs.statSync(file).isFile() && sha(fs.readFileSync(file))===hash;}
function assertPayload(bundle,manifest) {
  const patch=path.join(bundle,'core.patch');
  if(!equalFile(patch,manifest.patchSha256))throw new Error('Upgrade patch checksum mismatch');
  for(const file of manifest.overlays) {
    const source=safeDestination(path.join(bundle,'files'),file.path);
    if(!equalFile(source,file.sha256))throw new Error('Payload checksum mismatch: '+file.path);
  }
  return patch;
}
export async function prepareUpgrade(bundle,target) {
  bundle=fs.realpathSync(bundle);target=fs.realpathSync(target);
  const manifest=readJson(path.join(bundle,'manifest.json'));
  if(manifest.format!==1)throw new Error('Unsupported upgrade manifest format');
  const patch=assertPayload(bundle,manifest);
  const marker=path.join(target,'.qqbridge-custom-state.json');
  const touched=[...manifest.patchedFiles.map(f=>f.path),...manifest.overlays.map(f=>f.path)];
  if(new Set(touched).size!==touched.length)throw new Error('Duplicate payload destinations');
  for(const relative of touched)safeDestination(target,relative);
  if(fs.existsSync(marker)) {
    const state=readJson(marker);
    if(state.bundleId!==manifest.bundleId)throw new Error('A different custom bundle is already applied; use a clean upstream checkout');
    const changed=state.files.filter(f=>!equalFile(safeDestination(target,f.path),f.sha256));
    if(changed.length)throw new Error('Previously applied files have local edits: '+changed.map(x=>x.path).join(', '));
    return {alreadyApplied:true,manifest,target,cleanup(){}};
  }
  for(const f of manifest.overlays) {
    const dest=safeDestination(target,f.path);
    if(fs.existsSync(dest)&&!equalFile(dest,f.sha256))throw new Error('Custom module already exists with different content: '+f.path);
  }
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qqbridge-upgrade-'));
  const cleanup=()=>{const resolved=path.resolve(scratch);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('qqbridge-upgrade-'))throw new Error('Unsafe temporary cleanup');fs.rmSync(resolved,{recursive:true,force:true});};
  try {
    const inputHashes={};
    for(const f of manifest.patchedFiles) {
      const source=safeDestination(target,f.path);
      if(!fs.existsSync(source)||!fs.statSync(source).isFile())throw new Error('Missing upstream file: '+f.path);
      const data=fs.readFileSync(source);inputHashes[f.path]=sha(data);
      const out=safeDestination(scratch,f.path);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,data.toString('utf8').replace(/\r\n/g,'\n'));
    }
    gitApply(scratch,patch,true);
    gitApply(scratch,patch,false);
    const {renderCustomizedConsole}=await import(pathToFileURL(path.join(bundle,'files/custom/console/render.js')).href);
    renderCustomizedConsole(fs.readFileSync(path.join(target,'public/console.html'),'utf8'));
    for(const f of manifest.overlays) {
      const dest=safeDestination(scratch,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});
      copyBytes(safeDestination(path.join(bundle,'files'),f.path),dest);
    }
    fs.writeFileSync(path.join(scratch,'package.json'),JSON.stringify({type:'module'}));
    // Parse every changed JavaScript file without importing or running application code.
    for(const relative of touched.filter(p=>/\.(?:mjs|js)$/.test(p))) {
      const result=spawnSync(process.execPath,['--check',safeDestination(scratch,relative)],{encoding:'utf8'});
      if(result.status!==0)throw new Error('Patched source syntax check failed: '+relative+'\n'+result.stderr);
    }
    return {alreadyApplied:false,manifest,target,scratch,touched,inputHashes,cleanup};
  } catch(error){cleanup();throw error;}
}
export async function applyUpgrade(bundle,target,{checkOnly=true}={}) {
  const plan=await prepareUpgrade(bundle,target);
  try {
    if(plan.alreadyApplied)return {ok:true,alreadyApplied:true,bundleId:plan.manifest.bundleId};
    if(checkOnly)return {ok:true,checkOnly:true,bundleId:plan.manifest.bundleId,patchedFiles:plan.manifest.patchedFiles.length,overlayFiles:plan.manifest.overlays.length};
    for(const [relative,hash] of Object.entries(plan.inputHashes))
      if(!equalFile(safeDestination(plan.target,relative),hash))throw new Error('Target changed during preflight: '+relative);
    const backupRoot=path.join(plan.target,'.qqbridge-custom-backups');
    if(fs.existsSync(backupRoot)&&fs.lstatSync(backupRoot).isSymbolicLink())throw new Error('Backup folder cannot be a symbolic link');
    const backup=path.join(backupRoot,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));
    fs.mkdirSync(backup,{recursive:true,mode:0o700});
    const originals=[];
    for(const relative of plan.touched) {
      const dest=safeDestination(plan.target,relative),existed=fs.existsSync(dest);
      if(existed){const saved=path.join(backup,...relative.split('/'));fs.mkdirSync(path.dirname(saved),{recursive:true});copyBytes(dest,saved);}
      originals.push({path:relative,existed});
    }
    fs.writeFileSync(path.join(backup,'restore-manifest.json'),JSON.stringify({target:plan.target,files:originals},null,2)+'\n');
    const written=[];
    try {
      for(const relative of plan.touched) {
        const dest=safeDestination(plan.target,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});
        written.push(relative);copyBytes(safeDestination(plan.scratch,relative),dest);
      }
      const files=plan.touched.map(relative=>({path:relative,sha256:sha(fs.readFileSync(safeDestination(plan.target,relative)))}));
      fs.writeFileSync(path.join(plan.target,'.qqbridge-custom-state.json'),JSON.stringify({format:1,bundleId:plan.manifest.bundleId,appliedAt:new Date().toISOString(),backup,files},null,2)+'\n');
      return {ok:true,applied:true,bundleId:plan.manifest.bundleId,patchedFiles:plan.manifest.patchedFiles.length,overlayFiles:plan.manifest.overlays.length,backup};
    } catch(error) {
      for(const relative of written.reverse()) {
        const record=originals.find(f=>f.path===relative),dest=safeDestination(plan.target,relative);
        if(record.existed)copyBytes(path.join(backup,...relative.split('/')),dest);
        else if(fs.existsSync(dest))fs.unlinkSync(dest);
      }
      throw new Error('Apply failed; written files were restored from '+backup+'\n'+error.message);
    }
  } finally {plan.cleanup();}
}
async function main() {
  const [command,...args]=process.argv.slice(2),targetAt=args.indexOf('--target');
  if(!['check','apply'].includes(command)||targetAt<0||!args[targetAt+1])throw new Error('Usage: node apply.mjs check|apply --target <clean-upstream-directory>');
  const result=await applyUpgrade(here,path.resolve(args[targetAt+1]),{checkOnly:command==='check'});
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
