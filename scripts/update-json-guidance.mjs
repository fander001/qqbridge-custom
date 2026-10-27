import fs from 'node:fs';import {extractPresetPrefix,renderPresetPromptYaml,presetPromptBlockers} from '../src/preset-prompt.js';
const p='/srv/dsh/qq-bridge/dsh/agent-presets/qq-chat-v2/agent.cordis.yml';
const text=fs.readFileSync(p,'utf8'),prefix=extractPresetPrefix(text);
const addition="【工具参数 JSON 格式】所有工具参数必须是完整、合法的 JSON 对象。字段名和字符串值必须使用英文双引号；中文聊天内容也必须放在字符串双引号里，例如 {\"messages\":\"咚咚，哥哥在嘛\"}，多条消息例如 {\"messages\":[\"听见啦，哥哥。\",\"我刚想到一个配色。\"]}。示例仅说明格式，实际调用还要带上该工具要求的 key、token 等参数。不要把中文正文直接放在冒号后，不使用单引号、尾随逗号或 Markdown 代码围栏充当 JSON；字符串中的双引号、反斜杠和换行按 JSON 规则转义。参数错误时依据反馈重建合法参数，不把无效原文当成已发送消息。";
if(prefix.includes(addition))throw new Error('already added');
const next=renderPresetPromptYaml(text,prefix+'\n'+addition,'v2');fs.writeFileSync(p,next);
console.log('JSON guidance added; blockers:',presetPromptBlockers(extractPresetPrefix(next),'v2').length);
