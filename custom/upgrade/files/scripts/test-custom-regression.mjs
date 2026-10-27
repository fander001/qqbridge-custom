#!/usr/bin/env node
// Safe regression entry point: temporary configurations and fake peers only.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url));
const tests=[
 'test-group-master-schedule.mjs','test-master-schedule-api.mjs','test-console-controls-ui.mjs',
 'test-unified-group-policy.mjs','test-unified-controls-api.mjs','test-console-controls.mjs',
 'test-group-continuous90.mjs','test-group-observer.mjs','test-group-participation.mjs',
 'test-autonomy-schedule.mjs','test-audit-bridge.mjs','test-qq-preset-contract.mjs',
 'test-installed-preset-sync.mjs','test-custom-modules.mjs','test-console-static.mjs',
 'test-audit-security.mjs','test-audit-security-mcp.mjs','test-audit-regressions.mjs'
];
const results=[];
for(const name of tests) {
 const result=spawnSync(process.execPath,[path.join(root,'scripts',name)],{cwd:root,encoding:'utf8',timeout:60000,env:{...process.env,QQ_BRIDGE_TEST_LIVE:'0'}});
 const ok=result.status===0&&!result.error;results.push({name,ok});
 console.log((ok?'PASS ':'FAIL ')+name);
 if(!ok){console.error(result.error?.message??'');console.error(result.stdout);console.error(result.stderr);}
}
console.log(JSON.stringify({passed:results.filter(x=>x.ok).length,total:results.length,failed:results.filter(x=>!x.ok).map(x=>x.name)}));
if(results.some(x=>!x.ok))process.exitCode=1;
