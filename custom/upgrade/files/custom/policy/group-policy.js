export const GROUP_POLICY_DEFAULTS = Object.freeze({
 peak: Object.freeze({ownerAtMention:true,memberAtMention:false,quoteReply:false,textWake:false,followup:false,ambientSampling:false,idleProactive:false}),
 offPeak: Object.freeze({ownerAtMention:true,memberAtMention:true,quoteReply:true,textWake:true,followup:true,ambientSampling:true,idleProactive:true})
});
export const GROUP_POLICY_KEYS = Object.freeze(Object.keys(GROUP_POLICY_DEFAULTS.peak));
export function mergeGroupPolicy(value={}) {
 return {peak:{...GROUP_POLICY_DEFAULTS.peak,...value?.peak},offPeak:{...GROUP_POLICY_DEFAULTS.offPeak,...value?.offPeak}};
}
export function groupReasonControl(reason) {
 const base=String(reason??'').replace(/@seq\d+$/,'');
 if(base==='ownerAtMention')return 'ownerAtMention';
 if(base==='atMention')return 'memberAtMention';
 if(base==='quoteReply')return 'quoteReply';
 if(base==='groupFollowup')return 'followup';
 if(base==='probability'||base==='anyMessage')return 'ambientSampling';
 if(['nameMention','question','poke'].includes(base)||base.startsWith('keyword:')||base.startsWith('speaker:'))return 'textWake';
 return 'idleProactive';
}
export function groupPolicyAllows(policy,phase,reason,enabled=true) {
 if(!enabled)return false;
 return mergeGroupPolicy(policy)[phase==='peak'?'peak':'offPeak'][groupReasonControl(reason)]===true;
}
export function validateGroupPolicy(value) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid groupPolicy');
 const out={};
 for(const [phase,row] of Object.entries(value)) {
  if(!['peak','offPeak'].includes(phase)||!row||typeof row!=='object'||Array.isArray(row))throw new Error('Invalid group policy period');
  out[phase]={};
  for(const [key,v] of Object.entries(row)){if(!GROUP_POLICY_KEYS.includes(key)||typeof v!=='boolean')throw new Error('Invalid group policy switch: '+key);out[phase][key]=v;}
 }
 return out;
}
