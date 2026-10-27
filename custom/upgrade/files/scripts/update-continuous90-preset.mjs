import fs from 'node:fs';import {extractPresetPrefix,renderPresetPromptYaml,presetPromptBlockers} from '../src/preset-prompt.js';
const p='/srv/dsh/qq-bridge/dsh/agent-presets/qq-chat-v2/agent.cordis.yml';
const text=fs.readFileSync(p,'utf8');let prefix=extractPresetPrefix(text);
const sections=JSON.parse(fs.readFileSync(new URL('./continuous90-sections.json',import.meta.url),'utf8'));
for(const [title,body]of Object.entries(sections)){
 const start=prefix.startsWith(title)?0:prefix.indexOf('\n'+title)+1;if(start<1&&!prefix.startsWith(title))throw new Error('missing section');
 const next=prefix.indexOf('\n【',start+title.length);
 prefix=prefix.slice(0,start)+title+' '+body+'\n\n'+(next<0?'':prefix.slice(next+1));
}
const rule='5. 【唤醒与自主权】群聊默认旁观，真实艾特、直接引用、配置中的名字和关键词可以唤醒。哥哥真实艾特优先回应并可绕过主动冷却，其他点名选择性回应；已经建立对话后，原对话人接话不用每句重新艾特。回应后连续观察90秒，有人接话则继续回应并重新计时，连续90秒无人接话才潜水。主动巡游和另起话题仍只在半价时段，服从冷却，保持 diving、infinite=true、anyMessage=false，未被点名的普通消息采样沿用 0.05，不逐句回应全群。 6. 【等特定的人】';
const re=/5\. 【唤醒与自主权】[\s\S]*? 6\. 【等特定的人】/;
if(!re.test(prefix))throw new Error('wake protocol not found');
prefix=prefix.replace(re,rule).replaceAll('群聊仍遵守每轮最多三条','群聊仍遵守每次回应最多三条');
prefix=prefix.replace('其他人的真实艾特或直接引用按语境选择性回应','其他人的真实艾特、直接引用、叫名字或当前对话中的接话按语境选择性回应');
prefix=prefix.replace('以及其他人真实艾特的选择性回应','以及其他人真实艾特、叫名字和当前对话接话的选择性回应');
prefix=prefix.replace('4. 完成必要的已读与唤醒收尾后结束本轮，不追加无内容的说明，也不为延续聊天而重新进入等待。','4. 群聊仍在90秒接话窗口内时按需继续等待，观察完成后确认已读与唤醒状态并结束，不追加操作报告。');
if(presetPromptBlockers(prefix,'v2').length)throw new Error('safety blockers');
fs.writeFileSync(p,renderPresetPromptYaml(text,prefix,'v2'));console.log('90s conversation preset updated',prefix.length);
