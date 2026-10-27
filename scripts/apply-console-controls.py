from pathlib import Path
b=Path('/srv/dsh/qq-bridge');p=b/'src/bridge.js';s=p.read_text()
def replace(a,c):
 global s
 assert a in s,a[:120]
 s=s.replace(a,c,1)
replace("import { createTokenLedger }", "import { GROUP_CONTROL_DEFAULTS, validateControlSettings } from './console-controls.js';\nimport { createTokenLedger }")
replace('  const groupEventMeta = new Map();','  const groupEventMeta = new Map();\n  const ownerOnlyGroupKeys = new Set();')
replace("return JSON.stringify([currentMode, modePreset(key, currentMode, cfg) ?? '', currentMode === 'closed-agent' ? cfg.ownerQQ : null]);", "const base = [currentMode, modePreset(key, currentMode, cfg) ?? '', currentMode === 'closed-agent' ? cfg.ownerQQ : null];\n    if (readRoleState().mode === 'silent' && key !== `private:${String(cfg.ownerQQ ?? '')}`) base.push('owner-only');\n    return JSON.stringify(base);")
replace('  function forgetConversationCaches(key) {','  function forgetConversationCaches(key) {\n    const w = groupWindows.get(key); if (w) w.closed = true; groupWindows.delete(key);\n    const g = groupTurns.get(key); if (g) g.closed = true; groupTurns.delete(key);\n    groupEventMeta.delete(key); ownerOnlyGroupKeys.delete(key);')
a=s.index('    return { autonomousCooldownMs:',s.index('function groupObserverConfig'));z=s.index('\n  }',a)
s=s[:a]+"    return { ...GROUP_CONTROL_DEFAULTS, ...(cfg.socialV2?.groupObserver ?? {}) };"+s[z:]
replace("wakeReasonBase(reason) === 'ownerAtMention' ? 1000", "wakeReasonBase(reason) === 'ownerAtMention' ? Math.max(1000, Number(groupObserverConfig().ownerWakeBatchMs) || 1000)")
s=s.replace('burstMaxMessages: 3 } : cfg.socialV2?.send', 'burstMaxMessages: groupObserverConfig().maxMessagesPerTurn } : cfg.socialV2?.send')
replace("    return roleState.mode === 'silent' && key !== `private:${String(cfg.ownerQQ ?? '')}`;", "    return roleState.mode === 'silent' && key !== `private:${String(cfg.ownerQQ ?? '')}`\n      && !(String(key).startsWith('group:') && ownerOnlyGroupKeys.has(key));")
replace('    return () => {\n      if (!isSessionAllowedInCurrentMode(key)',"    return () => {\n      if (shouldBlockSilentReply(key)) throw new Error('Reply switch is off: administrator only');\n      if (!isSessionAllowedInCurrentMode(key)")
replace('  async function handleIncoming(kind, id, event, cfg) {\n    const key = convKey(kind, id);', "  async function handleIncoming(kind, id, event, cfg) {\n    const key = convKey(kind, id);\n    if (readRoleState().mode === 'silent' && String(event.user_id) !== String(cfg.ownerQQ ?? '')) return;")
replace("    const roleState = readRoleState();\n\n    // \u82e5\u8be5\u4f1a\u8bdd", "    const roleState = readRoleState();\n    if (roleState.mode === 'silent') {\n      if (!isOwner) return;\n      if (kind === 'group') ownerOnlyGroupKeys.add(key);\n    }\n\n    // \u82e5\u8be5\u4f1a\u8bdd")
replace('  function autonomyWakeBlocked(key, reason) {\n    return Boolean(reason)',"  function autonomyWakeBlocked(key, reason) {\n    if (readRoleState().mode === 'silent' && (shouldBlockSilentReply(key) || (key.startsWith('group:') && !directReplyWake(key, reason)))) return true;\n    return Boolean(reason)")
replace("    const antiAiLine = '", "    const ownerScopeLine = readRoleState().mode === 'silent' ? '\u3010\u5bf9\u5916\u56de\u590d\u5df2\u5173\u95ed\u3011\u53ea\u56de\u5e94\u7ba1\u7406\u5458\u672c\u4eba\u5f53\u524d\u53d1\u8a00\uff1b\u7fa4\u53cb\u5386\u53f2\u6d88\u606f\u4ec5\u4f5c\u80cc\u666f\uff0c\u4e0d\u56de\u590d\u3001\u4e0d\u4e3b\u52a8\u627e\u7fa4\u53cb\u8bf4\u8bdd\u3002\\n\\n' : '';\n    const antiAiLine = ownerScopeLine + '")
replace("          writeRoleState(rs.role, mode);\n          log(`\u63a7\u5236\u53f0\uff1a\u9759\u9ed8\u6a21\u5f0f", "          applyReplyMode(mode);\n          log(`\u63a7\u5236\u53f0\uff1a\u9759\u9ed8\u6a21\u5f0f")
marker="        if (req.method === 'POST' && url.pathname === '/api/role-mode') {"
api="""        if (url.pathname === '/api/control-settings' && ['GET', 'POST'].includes(req.method)) {
          if (req.method === 'POST') {
            let change; try { change = validateControlSettings(await readBody()); }
            catch (error) { sendJson({ok:false,error:error.message},400); return; }
            const file = readConfigObject(path.join(ROOT,'config.json'));
            if (change.groupObserver) {
              file.socialV2 = {...(file.socialV2 ?? {}), groupObserver:{...(file.socialV2?.groupObserver ?? {}),...change.groupObserver}};
              cfg.socialV2 = {...(cfg.socialV2 ?? {}),groupObserver:file.socialV2.groupObserver};
            }
            if (change.autonomySchedule) { file.autonomySchedule = {...(file.autonomySchedule ?? {}),...change.autonomySchedule}; cfg.autonomySchedule = file.autonomySchedule; }
            if (change.groupObserver || change.autonomySchedule) atomicWriteJson(path.join(ROOT,'config.json'),file);
            if ('replyToOthersEnabled' in change) applyReplyMode(change.replyToOthersEnabled ? 'active' : 'silent');
            if (change.groupObserver) {
              for (const [key,w] of groupWindows) if (!w.closed && w.spoken) {
                w.expiresAt = Math.max(w.lastReplyAt || 0,w.lastRelevantAt || 0) + groupIdleMs();
                const lease = groupTurns.get(key); if (lease && !lease.closed) lease.deadline = w.expiresAt + 5000;
              }
            }
            if (change.autonomySchedule) { for (const key of socialV2.conversations.keys()) {clearSocialV2Timers(key);setupSleepTimerV2(key);} void maintainAutonomySchedule(); }
            log('Console: conversation controls saved');
          }
          sendJson({ok:true,replyToOthersEnabled:readRoleState().mode !== 'silent',groupObserver:groupObserverConfig(),autonomySchedule:cfg.autonomySchedule ?? {},scheduleStatus:autonomyStatus()});return;
        }
"""
replace(marker,api+marker)
marker='  function shouldBlockSilentReply(key) {'
helper="""  function applyReplyMode(mode) {
    const rs = readRoleState(); if (rs.mode === mode) return;
    writeRoleState(rs.role, mode);
    const ownerKey = `private:${String(cfg.ownerQQ ?? '')}`;
    const keys = new Set([...Object.keys(state.sessions),...socialV2.conversations.keys(),...groupWindows.keys(),...pending.keys(),...promptQueues.keys()]);
    for (const key of keys) if (key !== ownerKey) {
      const st = socialV2.conversations.get(key);
      if (st) { clearTimeout(st.pendingWakeTimer);st.pendingWakeTimer=null;st.pendingWakeReason=null;st.pendingWakeReasons=[]; }
      promptQueues.delete(key);retireSession(key);clearSocialV2Timers(key);cancelSocialTimers(key);
    }
    ownerOnlyGroupKeys.clear();saveState();saveSocialV2State();
  }
"""
replace(marker,helper+marker)
p.write_text(s)
p=b/'scripts/audit-bridge-harness.mjs';s=p.read_text().replace("import * as autonomySchedule", "import * as consoleControls from '../src/console-controls.js';\nimport * as autonomySchedule").replace('...modelPrices, ...autonomySchedule', '...consoleControls, ...modelPrices, ...autonomySchedule').replace('groupTurns, beginGroupTurn,','applyReplyMode, shouldBlockSilentReply, ownerOnlyGroupKeys, sessionPolicy, groupTurns, beginGroupTurn,');p.write_text(s)
p=b/'src/autonomy-schedule.js';s=p.read_text();s=s.replace('  const peak = weekday <= 5 && !holiday && ((minute >= 540 && minute < 720) || (minute >= 840 && minute < 1080));',"""  const days = schedule.peakWeekdays ?? [1,2,3,4,5];
  const windows = schedule.peakWindows ?? [['09:00','12:00'],['14:00','18:00']];
  const toMinute = t => { if (typeof t !== 'string' || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(t)) return NaN; const [h,m]=t.split(':').map(Number);return h*60+m; };
  if (!Array.isArray(days) || days.some(x=>!Number.isInteger(x)||x<1||x>7) || !Array.isArray(windows) || windows.some(w=>!Array.isArray(w)||w.length!==2||!Number.isFinite(toMinute(w[0]))||!Number.isFinite(toMinute(w[1]))||toMinute(w[0])>=toMinute(w[1]))) return {enabled,allowed:!enabled,reason:'invalid-schedule'};
  const peak = days.includes(weekday) && !holiday && windows.some(w => minute >= toMinute(w[0]) && minute < toMinute(w[1]));""");p.write_text(s)
print('BACKEND_EDITED')
