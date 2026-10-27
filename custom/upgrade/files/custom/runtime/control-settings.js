import path from 'node:path';
import { normalizeMasterSchedule, masterScheduleState } from '../policy/group-master-schedule.js';
import { mergeGroupPolicy } from '../policy/group-policy.js';
import { validateControlSettings } from '../policy/console-controls.js';

/** Existing control-settings HTTP contract; storage and lifecycle services are injected. */
export function createControlSettingsHandler(host, group) {
  const cfg = host.config;
  const Date = host.clock ?? globalThis.Date;
  const {ROOT, readConfigObject, atomicWriteJson, clearSocialV2Timers, setupSleepTimerV2, scheduleProactiveCheckV2, log} = host;
  const {groupMasterEnabled, groupPolicyState, groupObserverConfig, groupIdleMs, groupWindows, groupTurns,
    applyReplyMode, enforceMasterSchedule, retireGroupPolicyWork, reconcileGroupRestrictions,
    maintainAutonomySchedule, autonomyStatus} = group;
  async function handleControlSettings(method, readBody, sendJson) {
          if (method==='POST') {
            let change;try{change=validateControlSettings(await readBody());}catch(error){sendJson({ok:false,error:error.message},400);return;}
            const file=readConfigObject(path.join(ROOT,'config.json'));
            const scheduleBefore=JSON.stringify(normalizeMasterSchedule(cfg.groupMasterSchedule));
            if(change.groupMasterSchedule){
              const next={...normalizeMasterSchedule(file.groupMasterSchedule),...change.groupMasterSchedule};
              if(next.enabled&&!masterScheduleState(Date.now(),next).valid){sendJson({ok:false,error:'开启和关闭时间必须填写完整，且不能相同'},400);return;}
              if(next.enabled&&'replyToOthersEnabled' in change){sendJson({ok:false,error:'请分别保存定时设置或手动切换总开关'},400);return;}
              file.groupMasterSchedule=next;
            }
            if('replyToOthersEnabled' in change&&file.groupMasterSchedule?.enabled===true)file.groupMasterSchedule={...normalizeMasterSchedule(file.groupMasterSchedule),enabled:false};
            const scheduleChanged=scheduleBefore!==JSON.stringify(normalizeMasterSchedule(file.groupMasterSchedule));
            if(change.groupObserver)file.socialV2={...(file.socialV2??{}),groupObserver:{...(file.socialV2?.groupObserver??{}),...change.groupObserver}};
            if(change.proactive){
              const next={...(file.socialV2?.proactive??{}),...change.proactive};
              if((next.checkIntervalMaxMs??5400000)<(next.checkIntervalMinMs??1800000)){sendJson({ok:false,error:'Maximum interval must be >= minimum'},400);return;}
              file.socialV2={...(file.socialV2??{}),proactive:next};
            }
            if(change.autonomySchedule)file.autonomySchedule={...(file.autonomySchedule??{}),...change.autonomySchedule};
            const previousPolicy=JSON.stringify(mergeGroupPolicy(cfg.groupPolicy));
            if(change.groupPolicy){const old=mergeGroupPolicy(file.groupPolicy);file.groupPolicy={peak:{...old.peak,...change.groupPolicy.peak},offPeak:{...old.offPeak,...change.groupPolicy.offPeak}};}
            const policyChanged=previousPolicy!==JSON.stringify(mergeGroupPolicy(file.groupPolicy));
            if(change.groupObserver||change.proactive||change.autonomySchedule||change.groupPolicy||change.groupMasterSchedule||scheduleChanged){
              atomicWriteJson(path.join(ROOT,'config.json'),file);cfg.socialV2=file.socialV2??cfg.socialV2;cfg.autonomySchedule=file.autonomySchedule;cfg.groupPolicy=file.groupPolicy;cfg.groupMasterSchedule=file.groupMasterSchedule;
            }
            if('replyToOthersEnabled' in change)applyReplyMode(change.replyToOthersEnabled?'active':'silent');
            enforceMasterSchedule();
            if(policyChanged)retireGroupPolicyWork();
            if(change.groupObserver)for(const [key,w] of groupWindows)if(!w.closed&&w.spoken){w.expiresAt=Math.max(w.lastReplyAt||0,w.lastRelevantAt||0)+groupIdleMs();const lease=groupTurns.get(key);if(lease&&!lease.closed)lease.deadline=w.expiresAt+5000;}
            if(change.proactive||change.autonomySchedule)for(const key of host.socialV2.conversations.keys()){clearSocialV2Timers(key);setupSleepTimerV2(key);scheduleProactiveCheckV2(key);}
            reconcileGroupRestrictions();void maintainAutonomySchedule();log('Console: unified group controls saved');
          }
          sendJson({ok:true,groupMasterSchedule:normalizeMasterSchedule(cfg.groupMasterSchedule),masterScheduleState:masterScheduleState(Date.now(),cfg.groupMasterSchedule),groupChatEnabled:groupMasterEnabled(),replyToOthersEnabled:groupMasterEnabled(),groupPolicy:mergeGroupPolicy(cfg.groupPolicy),effectiveGroupPolicy:groupPolicyState(),groupObserver:groupObserverConfig(),proactive:cfg.socialV2?.proactive??{},autonomySchedule:cfg.autonomySchedule??{},scheduleStatus:autonomyStatus(),deferredReplies:{supported:false,reason:'Only busy-turn wake buffering exists; blocked calls are not queued'}});return;
  }

  return handleControlSettings;
}
