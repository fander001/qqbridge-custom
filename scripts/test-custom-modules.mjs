import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {bridgeHarness} from './audit-bridge-harness.mjs';
import {consoleGateway} from '../custom/runtime/console-gateway.js';
import {readCustomizedConsole,renderCustomizedConsole} from '../custom/console/render.js';
const expectedUi='2803174ebce7a0804caea546513757d6861a903e41b2ae3faaf306fabe0c6fb7';
const html=readCustomizedConsole();
const currentUi=crypto.createHash('sha256').update(html).digest('hex');
const baseHash=crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/console.html',import.meta.url))).digest('hex');
if(baseHash==='6f7c7e15ecea2e4ffec06770e655e549fb1a2960441ea4f89ff22ebbff686a22')assert.equal(currentUi,expectedUi,'the pinned upstream must preserve the captured pre-refactor view');
assert.ok(html.includes('id="section-silent" data-page="controls"'));
assert.throws(()=>renderCustomizedConsole('<html>incompatible upstream</html>'),/anchor conflict/);
const secret='fixture-only-'.repeat(4),origin='https://192.0.2.5:3100';
const env={QQ_BRIDGE_CONSOLE_ORIGIN:origin,QQ_BRIDGE_GATEWAY_KEY:secret};
const request=(method='GET',headers={},address='127.0.0.1')=>({method,headers,socket:{remoteAddress:address}});
assert.equal(consoleGateway(request('GET',{'x-qq-gateway-key':secret}),'192.0.2.5:3100',env).gatewayRequest,true);
for(const [req,host] of [[request(),'192.0.2.5:3100'],[request('GET',{'x-qq-gateway-key':'wrong'}),'192.0.2.5:3100'],[request('GET',{'x-qq-gateway-key':secret},'192.0.2.6'),'192.0.2.5:3100'],[request('GET',{'x-qq-gateway-key':secret}),'attacker.invalid']])
  assert.equal(consoleGateway(req,host,env).gatewayRequest,false);
assert.equal(consoleGateway(request('POST',{'x-qq-gateway-key':secret}),'192.0.2.5:3100',env).crossOrigin,true);
assert.equal(consoleGateway(request('POST',{'x-qq-gateway-key':secret,origin}),'192.0.2.5:3100',env).crossOrigin,false);
assert.equal(consoleGateway(request('GET',{'x-qq-gateway-key':secret,origin:'https://attacker.invalid'}),'192.0.2.5:3100',env).crossOrigin,true);
const h1=await bridgeHarness({files:{'public/console.html':fs.readFileSync(new URL('../public/console.html',import.meta.url),'utf8')},globals:{consoleGateway:(req,host)=>consoleGateway(req,host,env)}});
const h2=await bridgeHarness();
let server;
try {
  h1.applyReplyMode('silent');
  assert.equal(h1.groupMasterEnabled(),false);
  assert.equal(h2.groupMasterEnabled(),true,'runtime instances must not share master state');
  assert.notEqual(h1.groupWindows,h2.groupWindows);
  server=h1.startConsoleServer(0);await new Promise(resolve=>server.once('listening',resolve));
  const port=server.address().port;
  const get=headers=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path:'/',headers},res=>{let body='';res.setEncoding('utf8');res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end();
  });
  const authorized=await get({host:'192.0.2.5:3100','x-qq-gateway-key':secret});
  assert.equal(authorized.status,200);assert.equal(crypto.createHash('sha256').update(authorized.body).digest('hex'),currentUi,'actual HTTP route must serve the composed page');
  assert.equal((await get({host:'192.0.2.5:3100'})).status,403);
  assert.equal((await get({host:'192.0.2.5:3100','x-qq-gateway-key':secret,origin:'https://attacker.invalid'})).status,403);
} finally {
  if(server)await new Promise(resolve=>server.close(resolve));await h1.close();await h2.close();
}
console.log('PASS custom module isolation, exact UI and authenticated gateway contracts');
