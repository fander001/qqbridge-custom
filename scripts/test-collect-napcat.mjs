import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {bridgeHarness} from './audit-bridge-harness.mjs';
const png=Buffer.from(['iVBORw0KGgoAAAANSUhEUgAA','AAEAAAABCAQAAAC1HAwCAAAA','C0lEQVR42mP8/x8AAwMCAO+k','3ioAAAAASUVORK5CYII='].join(''),'base64');
const md5=crypto.createHash('md5').update(png).digest('hex').toUpperCase();
const old={id:'existing',resId:'existing',url:'https://public.invalid/old',
 md5:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',localNote:'preserve original note'};
const h=await bridgeHarness({files:{'state/stickers.json':[old]}});
let added=0,mods=0,published=false;
try{
 h.setMode('reserved2');
 const host=path.join(h.temp,'shared');
 h.cfg.snowluma.sharedMedia={hostDir:host,gatewayDir:'/gateway-cache'};
 h.bot.getImage=async()=>({base64:png.toString('base64')});
 h.bot.request=async(action,params)=>{
  if(action==='fetch_custom_face_detail')return {status:'ok',retcode:0,
   data:[{resId:old.id,url:old.url,md5:old.md5},...(published?
    [{resId:'native-favorite',url:'https://public.invalid/new.gif',md5}]:[])]};
  if(action==='add_custom_face'){
   added++;
   assert.ok(params.file.startsWith('/gateway-cache/'));
   assert.ok(params.file.length<150);
   assert.ok(!params.file.includes('base64:'));
   const staged=path.join(host,path.posix.basename(params.file));
   assert.deepEqual(fs.readFileSync(staged),png);
   published=true;
   return {status:'ok',retcode:0,data:{result:0,errMsg:''}};
  }
  if(action==='modify_custom_face'){mods++;throw new Error('not supported');}
  throw new Error('Unexpected action '+action);
 };
 const key='group:456';
 h.getSocialV2State(key).recentMessages.push({seq:1,messageId:'44',isSelf:false,
  media:[{kind:'image',file:'fixture-image'}]});
 const result=await h.collectStickerV2(key,'44','poke sticker');
 assert.equal(result.emojiId,'native-favorite');assert.equal(result.verified,true);
 assert.equal(result.entry.localNote,'poke sticker');
 assert.equal(added,1);assert.equal(mods,0,'official rename permission stays off');
 const again=await h.collectStickerV2(key,'44','updated note');
 assert.equal(added,1,'MD5 match prevents duplicate favorites');
 assert.equal(again.entry.localNote,'updated note');
 const all=await h.syncStickerLibrary(true);
 assert.equal(all.entries.find(e=>e.id===old.id).localNote,old.localNote);
 console.log('PASS NapCat shared paths, native result shape, MD5 lookup, local remarks, dedup, preserving old notes');
}finally{await h.close();}
