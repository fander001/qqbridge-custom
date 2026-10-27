import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from 'js-yaml';
import {apply as retryApply} from '/srv/dsh/runtime/packages/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm-retry/lib/index.js';
import {resolveRetryPolicy} from '/srv/dsh/runtime/packages/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js';
import {DeepSeekAdapter,resolveAdapterOptions} from '/srv/dsh/runtime/packages/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js';
const rows=yaml.load(fs.readFileSync('patches/deepseek-json-retry.patch.yml','utf8'));
let checks=0;const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
for(const row of rows){
 const p=resolveRetryPolicy(row.config.retryPolicy,'fixture');
 eq(p.mode,'normal');eq(p.maxRetries,2);eq(p.retryableCodes.includes('MALFORMED_RESPONSE'),true);
}
function runtime(){
 let definition,projection;const listeners=new Map(),events=[];
 const ctx={sessionProjections:{register(d){definition=d;projection=d.init();},stateOf(){return projection;}},
  on(name,fn){listeners.set(name,fn);return()=>listeners.delete(name);},effect(){},logger:{warn(){}}};
 retryApply(ctx,{}, {random:()=>0.5});
 const session={append(type,data){events.push({type,data});projection=definition.apply(projection,{type,data});}};
 const policy={...resolveRetryPolicy(rows[0].config.retryPolicy,'fixture'),initialDelayMs:1,maxDelayMs:2,jitterRatio:0};
 return {recover: listeners.get('agent/request-error'),events,payload:{agent:{session},turn:1,step:1,provider:'fixture',retryPolicy:policy,signal:new AbortController().signal},
  reset(){projection=definition.apply(projection,{type:'step/start',data:{}});}};
}
{
 const r=runtime(),p=r.payload;
 p.failure={code:'MALFORMED_RESPONSE',message:'tool input is invalid JSON'};
 eq((await r.recover(p,async()=>undefined))?.kind,'retry');
 eq((await r.recover(p,async()=>undefined))?.kind,'retry');
 eq(await r.recover(p,async()=>undefined),undefined,'bounded to two retries');
 eq(r.events.filter(e=>e.type==='llm/retry').length,2);
 r.reset();eq((await r.recover(p,async()=>undefined))?.kind,'retry','new step gets own budget');
 r.reset();p.failure={code:'INVALID_REQUEST',message:'bad request'};
 eq(await r.recover(p,async()=>undefined),undefined,'no retry on deterministic input error');
 p.failure={code:'MALFORMED_RESPONSE'};p.signal=AbortSignal.abort();
 eq(await r.recover(p,async()=>undefined),undefined,'cancellation not retried');
}
const sse=(args)=>[
 {type:'message_start',message:{usage:{input_tokens:3}}},
 {type:'content_block_start',index:0,content_block:{type:'tool_use',id:'fixture-call',name:'fixture_tool',input:{}}},
 {type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:args}},
 {type:'content_block_stop',index:0},
 {type:'message_delta',delta:{stop_reason:'tool_use'},usage:{output_tokens:2}},
 {type:'message_stop'}
].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join('');
const originalFetch=globalThis.fetch;
try{
 let requests=0,commits=0;
 const invalid='{"messages": hello}';const valid='{"messages":"hello"}';
 globalThis.fetch=async(url)=>{assert.ok(String(url).startsWith('http://fixture.invalid'));requests++;return new Response(sse(requests===1?invalid:valid),{status:200,headers:{'content-type':'text/event-stream'}});};
 const options={...resolveAdapterOptions({}),baseURL:'http://fixture.invalid'};
 const adapter=new DeepSeekAdapter({options:()=>options,resolveAuth:async()=>({headers:{}}),resolveUserId:()=> 'fixture',prepareExtensions:async()=>({fields:{},accept:async()=>{}})});
 const r=runtime();let recovered=false;
 for(let attempt=0;attempt<3;attempt++){
  const chunks=[];
  try{
   for await(const c of adapter.stream({provider:'fixture',model:options.models[0].id,messages:[],tools:[],maxOutputTokens:128}))chunks.push(c);
   for(const c of chunks)if(c.type==='block-end'&&c.block?.type==='tool-call'){JSON.parse(c.block.arguments);commits++;}
   recovered=true;break;
  }catch(error){
   if(error.code!=='MALFORMED_RESPONSE')console.log('FIXTURE_ERROR',error.message,error.cause?.message);
   eq(error.code,'MALFORMED_RESPONSE','real shipped adapter reproduces failure');
   const decision=await r.recover({...r.payload,failure:{code:error.code,message:error.message}},async()=>undefined);
   if(decision?.kind!=='retry')throw error;
  }
 }
 eq(recovered,true);eq(requests,2,'one bad sample then one valid sample');eq(commits,1,'no malformed tool executed, no duplicate success');
}finally{globalThis.fetch=originalFetch;}
console.log('PASS JSON recovery checks:',checks);
