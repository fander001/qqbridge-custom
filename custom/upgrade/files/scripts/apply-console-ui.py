from pathlib import Path
p=Path('/srv/dsh/qq-bridge/public/console.html');s=p.read_text()
a=s.index('<section id="section-silent"');z=s.index('<section id="section-dsh"',a)
s=s[:a]+'''<section id="section-silent" data-page="overview" class="card">
<h2>\u5bf9\u5916\u56de\u590d\u603b\u5f00\u5173</h2>
<p id="replySwitchStatus" role="status"></p>
<div class="row"><button id="silentOff">\u5f00\u542f\u5bf9\u5916\u56de\u590d</button><button id="silentOn">\u5173\u95ed\uff08\u4ec5\u7ba1\u7406\u5458\uff09</button></div>
<p class="meta">\u5173\u95ed\u540e\uff0c\u975e\u7ba1\u7406\u5458\u7684\u79c1\u804a\u3001\u7fa4\u5185\u827e\u7279\u548c\u7eed\u804a\u90fd\u4e0d\u56de\u590d\uff0c\u4e5f\u4e0d\u4e3b\u52a8\u627e\u7fa4\u53cb\u8bf4\u8bdd\u3002\u7ba1\u7406\u5458\u79c1\u804a\u53ca\u7fa4\u5185\u4e92\u52a8\u4ecd\u6309\u65e2\u6709\u89c4\u5219\u8fdb\u884c\u3002\u5207\u6362\u4f1a\u7ec8\u6b62\u76f8\u5173\u7fa4\u804a\u4efb\u52a1\uff0c\u5386\u53f2\u8bb0\u5f55\u548c\u8bb0\u5fc6\u4fdd\u7559\u3002</p>
<p class="meta">\u4ec5\u63a7\u5236 qq-bridge\uff1bAstrBot \u7684\u56de\u590d\u4e0d\u53d7\u6b64\u5f00\u5173\u63a7\u5236\u3002\u5f00\u542f\u4ecd\u53d7\u767d\u540d\u5355\u3001\u9009\u62e9\u6027\u56de\u590d\u548c\u5cf0\u8c37\u89c4\u5219\u9650\u5236\u3002</p>
</section>
'''+s[z:]
fields=[('conversationIdleMs','\u65e0\u76f8\u5173\u63a5\u8bdd\u540e\u6f5c\u6c34\uff08\u79d2\uff09',1,600,1,1000),('autonomousCooldownMs','\u4e3b\u52a8\u53c2\u4e0e\u51b7\u5374\uff08\u79d2\uff09',0,3600,1,1000),('sampleProbability','\u65e0\u70b9\u540d\u65f6\u8bdd\u9898\u62bd\u6837\u6982\u7387\uff08%\uff09',0,100,1,.01),('maxMessagesPerTurn','\u6bcf\u6b21\u56de\u5e94\u6700\u591a\u5206\u6761',1,8,1,1),('directWakeBatchMs','\u666e\u901a\u70b9\u540d\u5408\u5e76\u7b49\u5f85\uff08\u79d2\uff09',1,8,.25,1000),('ownerWakeBatchMs','\u54e5\u54e5\u827e\u7279\u5408\u5e76\u7b49\u5f85\uff08\u79d2\uff09',1,8,.25,1000),('followupQuietMs','\u63a5\u8bdd\u6d88\u606f\u5408\u5e76\u9759\u9ed8\uff08\u79d2\uff09',.25,30,.25,1000),('maxTurnMs','\u666e\u901a\u5524\u9192\u9996\u6b21\u5904\u7406\u9884\u7b97\uff08\u79d2\uff09',10,600,1,1000),('ownerMaxTurnMs','\u54e5\u54e5\u5524\u9192\u9996\u6b21\u5904\u7406\u9884\u7b97\uff08\u79d2\uff09',10,600,1,1000),('closeAfterSendMs','\u975e\u8fde\u7eed\u6a21\u5f0f\u53d1\u9001\u540e\u6536\u5c3e\uff08\u79d2\uff09',1,600,1,1000)]
card='''<section id="section-conversation-controls" data-page="social-v2" class="card span-all"><h2>\u7fa4\u804a\u7eed\u804a\u4e0e\u5524\u9192</h2>
<p class="meta">\u9ed8\u8ba4\u65c1\u89c2\uff0c\u54e5\u54e5\u827e\u7279\u8981\u56de\u5e94\uff0c\u5176\u4ed6\u4eba\u827e\u7279\u548c\u7eed\u804a\u9009\u62e9\u6027\u56de\u5e94\u3002\u8fde\u7eed\u68c0\u6d4b\u4e0d\u4ee3\u8868\u6bcf\u53e5\u90fd\u56de\u590d\u3002\u4ec5\u4fdd\u5b58\u65f6\u751f\u6548\uff0c\u5355\u4f4d\u4e3a\u79d2\u3002</p>
<form id="groupControlsForm"><div class="row"><label for="gc-enabled">\u7fa4\u804a\u8282\u594f\u63a7\u5236</label><input id="gc-enabled" type="checkbox" style="width:auto"><label for="gc-continuousReplies">\u8fde\u7eed\u68c0\u6d4b\u76f8\u5173\u63a5\u8bdd</label><input id="gc-continuousReplies" type="checkbox" style="width:auto"></div>'''
for k,label,mn,mx,step,scale in fields:card+=f'<div class="row" style="margin-top:8px"><label for="gc-{k}" style="flex:1">{label}</label><input id="gc-{k}" type="number" required min="{mn}" max="{mx}" step="{step}" style="max-width:180px"></div>'
card+='''<p class="meta">\u62bd\u6837\u6982\u7387\u53ea\u662f\u4e3b\u52a8\u8bdd\u9898\u7684\u5019\u9009\u5524\u9192\uff0c\u6a21\u578b\u4ecd\u8981\u5224\u65ad\u662f\u5426\u63d2\u8bdd\uff1b\u4e0d\u5f71\u54cd\u771f\u5b9e\u827e\u7279\u3002\u8fde\u7eed\u6a21\u5f0f\u4e0b\uff0c\u53d1\u9001\u540e\u6536\u5c3e\u53c2\u6570\u4e0d\u751f\u6548\uff0c\u4ee5\u65e0\u63a5\u8bdd\u65f6\u957f\u4e3a\u51c6\u3002</p><button type="submit">\u4fdd\u5b58\u7eed\u804a\u4e0e\u5524\u9192\u8bbe\u7f6e</button><span class="meta" id="groupControlsMsg" role="status"></span></form></section>'''
card+='''<section id="section-peak-controls" data-page="social-v2" class="card span-all"><h2>\u5cf0\u8c37\u4e0e\u81ea\u4e3b\u6d3b\u52a8</h2><form id="scheduleControlsForm">
<div class="row"><label for="sc-enabled">\u4ec5\u5728\u7a7a\u95f2\uff08\u534a\u4ef7\uff09\u65f6\u6bb5\u81ea\u4e3b\u6d3b\u52a8</label><input type="checkbox" id="sc-enabled" style="width:auto"></div>
<p class="meta">\u5317\u4eac\u65f6\u95f4\u3002\u4ee5\u4e0b\u4e3a\u9ad8\u5cf0\u65f6\u6bb5\uff0c\u5176\u4f59\u65f6\u95f4\u4e3a\u7a7a\u95f2\u65f6\u6bb5\uff1b\u5df2\u6838\u5b9e\u6cd5\u5b9a\u8282\u5047\u65e5\u5168\u5929\u7a7a\u95f2\u3002\u5173\u95ed\u6b64\u9650\u5236\u4f1a\u5141\u8bb8\u5168\u5929\u81ea\u4e3b\u6d3b\u52a8\uff0c\u505c\u6b62\u5bf9\u5916\u56de\u590d\u8bf7\u7528\u603b\u89c8\u9875\u603b\u5f00\u5173\u3002</p><div class="row">'''
for i,n in enumerate(['\u5468\u4e00','\u5468\u4e8c','\u5468\u4e09','\u5468\u56db','\u5468\u4e94','\u5468\u516d','\u5468\u65e5'],1):card+=f'<label for="sc-day-{i}">{n}</label><input id="sc-day-{i}" type="checkbox" style="width:auto">'
card+='</div>'
for i in range(2):card+=f'<div class="row" style="margin-top:8px"><label for="sc-start-{i}">\u9ad8\u5cf0\u65f6\u6bb5{i+1}</label><input id="sc-start-{i}" type="time" required><span>\u81f3</span><input id="sc-end-{i}" type="time" aria-label="\u9ad8\u5cf0\u7ed3\u675f{i+1}" required></div>'
card+='''<p class="meta" id="scheduleCalendarInfo"></p><p class="meta">\u4e3b\u4eba\u79c1\u804a\u548c\u7fa4\u5185\u70b9\u540d\u7684\u88ab\u52a8\u56de\u5e94\u4e0d\u53d7\u5cf0\u8c37\u9650\u5236\u3002\u4e3b\u52a8\u9605\u8bfb\u3001\u4e3b\u52a8\u627e\u4eba\u8bf4\u8bdd\u3001\u7fa4\u804a\u5de1\u6e38\u4ecd\u9075\u5b88\u6b64\u65f6\u95f4\u8868\u3002</p><button type="submit">\u4fdd\u5b58\u5cf0\u8c37\u8bbe\u7f6e</button><span class="meta" id="scheduleControlsMsg" role="status"></span></form></section>'''
pos=s.index('<section id="section-silent"');s=s[:pos]+card+'\n'+s[pos:]
s=s.replace('async function loadV2Config() {','async function loadV2Config() {\n  void loadConversationControls();',1)
s=s.replace("s.roleMode === 'silent' ? '\u9759\u9ed8' : '\u6b63\u5e38'", "s.roleMode === 'silent' ? '\u4ec5\u7ba1\u7406\u5458' : '\u5bf9\u5916\u56de\u590d\u5f00\u542f'")
pos=s.index("    const modeLabel = s.mode")
s=s[:pos]+"""    document.getElementById('replySwitchStatus').textContent = s.roleMode === 'silent' ? '\u5df2\u5173\u95ed\uff1a\u4ec5\u7ba1\u7406\u5458\u53ef\u4ea4\u6d41' : '\u5df2\u5f00\u542f\uff1a\u6309\u65e2\u6709\u89c4\u5219\u9009\u62e9\u6027\u56de\u590d';
    document.getElementById('silentOn').disabled = s.roleMode === 'silent';
    document.getElementById('silentOff').disabled = s.roleMode !== 'silent';
"""+s[pos:]
# Dynamic schedule status, avoiding a stale hardcoded summary after editing.
a=s.index("    if (timingEl) timingEl.textContent");z=s.index("\n\n    document.querySelectorAll",a)
s=s[:a]+"    if (timingEl) timingEl.textContent = timing?.enabled ? (timing.allowed ? '\u5f53\u524d\u7a7a\u95f2\uff1a\u5141\u8bb8\u81ea\u4e3b\u6d3b\u52a8\u3002' : '\u5f53\u524d\u9ad8\u5cf0\uff1a\u4ec5\u88ab\u52a8\u56de\u5e94\u3002') + '\u65f6\u95f4\u8868\u89c1\u4e8c\u4ee3\u4eff\u771f\u9875\u3002' : '\u5cf0\u8c37\u9650\u5236\u5df2\u5173\u95ed\uff1a\u5141\u8bb8\u5168\u5929\u81ea\u4e3b\u6d3b\u52a8\u3002';"+s[z:]
import json
js='\nconst groupControlScales = '+json.dumps({x[0]:x[5] for x in fields})+';\n'
js+='''
async function loadConversationControls() {
 try {
  const r=await api('/api/control-settings');if(!r.ok) throw new Error(r.error);
  for(const [k,scale] of Object.entries(groupControlScales)) document.getElementById('gc-'+k).value=Number((r.groupObserver[k]/scale).toFixed(4));
  for(const k of ['enabled','continuousReplies']) document.getElementById('gc-'+k).checked=r.groupObserver[k]===true;
  updateGroupControls();
  const sc=r.autonomySchedule;document.getElementById('sc-enabled').checked=sc.enabled===true;
  for(let i=1;i<=7;i++) document.getElementById('sc-day-'+i).checked=(sc.peakWeekdays??[1,2,3,4,5]).includes(i);
  const windows=sc.peakWindows??[['09:00','12:00'],['14:00','18:00']];
  for(let i=0;i<2;i++){document.getElementById('sc-start-'+i).value=windows[i][0];document.getElementById('sc-end-'+i).value=windows[i][1];}
  document.getElementById('scheduleCalendarInfo').textContent='\u8282\u5047\u65e5\u65e5\u5386\u5df2\u6838\u5b9e\u5e74\u4efd\uff1a'+(sc.verifiedHolidayYears??[]).join(', ')+'\u3002\u65e5\u5386\u5f85\u66f4\u65b0\u7684\u5e74\u4efd\u6309\u666e\u901a\u5de5\u4f5c\u65e5\u5904\u7406\u3002';
 } catch(e) {document.getElementById('groupControlsMsg').textContent=e.message;}
}
function updateGroupControls(){document.getElementById('gc-closeAfterSendMs').disabled=document.getElementById('gc-continuousReplies').checked;}
document.getElementById('gc-continuousReplies').addEventListener('change',updateGroupControls);
async function saveControlSection(body,id) {
 const msg=document.getElementById(id);try {const r=await api('/api/control-settings','POST',body);if(!r.ok)throw new Error(r.error);msg.textContent='\u5df2\u4fdd\u5b58\u5e76\u751f\u6548';msg.className='meta ok';await loadConversationControls();await refresh();}catch(e){msg.textContent='\u4fdd\u5b58\u5931\u8d25\uff1a'+e.message;msg.className='meta err';}
}
document.getElementById('groupControlsForm').addEventListener('submit',e=>{e.preventDefault();const g={};for(const [k,scale] of Object.entries(groupControlScales))g[k]=k==='sampleProbability'?Number(document.getElementById('gc-'+k).value)*scale:Math.round(Number(document.getElementById('gc-'+k).value)*scale);for(const k of ['enabled','continuousReplies'])g[k]=document.getElementById('gc-'+k).checked;void saveControlSection({groupObserver:g},'groupControlsMsg');});
document.getElementById('scheduleControlsForm').addEventListener('submit',e=>{e.preventDefault();const sc={enabled:document.getElementById('sc-enabled').checked,peakWeekdays:[],peakWindows:[]};for(let i=1;i<=7;i++)if(document.getElementById('sc-day-'+i).checked)sc.peakWeekdays.push(i);for(let i=0;i<2;i++)sc.peakWindows.push([document.getElementById('sc-start-'+i).value,document.getElementById('sc-end-'+i).value]);void saveControlSection({autonomySchedule:sc},'scheduleControlsMsg');});
void loadConversationControls();
'''
pos=s.rfind('</script>');s=s[:pos]+js+s[pos:];p.write_text(s);print('UI_EDITED')
