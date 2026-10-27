// reserved2 提示词与插件边界的静态契约；不调用模型，不向 QQ 发送消息。
// 这些检查只能防止关键协议/能力被误删，不能证明聊天质量无损。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import yaml from 'js-yaml';

const preset = yaml.load(fs.readFileSync(
  new URL('../dsh/agent-presets/qq-chat-v2/agent.cordis.yml', import.meta.url), 'utf8',
));
const persona = preset.find((row) => row.id === 'persona');
const prefix = persona?.config?.prefix ?? '';

test('reserved2 YAML resolves to the expected persona and template variables', () => {
  assert.equal(persona?.name, '@deepseek-ai/dsh-persona');
  assert.match(prefix, /\{\{model\}\}/);
  // DSH 0.2.1 起 agent loop 只注册 provider / model 两个提示词变量（0.2.0 还有 cwd），
  // 未知变量会让 system prompt 装配直接抛错 ⇒ 每回合 error、模型一次都不跑。
  // 这里钉住「只用已注册变量」，而不只是「有 {{model}}」。
  const used = [...JSON.stringify(persona.config).matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(used)].filter((v) => !['provider', 'model'].includes(v)), []);
  assert.equal(Object.hasOwn(persona.config, 'text'), false);
});

test('local/admin tool restrictions and existing compaction budgets stay intact', () => {
  assert.deepEqual(preset.map((row) => row.id), [
    'persona', 'tool-web', 'tool-ask-user', 'tool-todo', 'qq-tool-restrict', 'compaction',
  ]);
  assert.deepEqual(preset.find((row) => row.id === 'tool-web').config, { search: false, fetch: false });
  assert.equal(preset.find((row) => row.id === 'qq-tool-restrict').name, './qq-tool-restrict.mjs');
  const compaction = preset.find((row) => row.id === 'compaction');
  assert.deepEqual(compaction.isolate, { compaction: true, toolResultPruner: true });
  assert.deepEqual(compaction.config.find((row) => row.id === 'tool-result-pruner').config, {
    thresholdChars: 50000, headChars: 45000, tailChars: 2000,
  });
  for (const text of ['你没有本地工具', '群友没有管理权限', 'API 令牌', '角色由桥接注入']) {
    assert.ok(prefix.includes(text), `missing safety rule: ${text}`);
  }
});

test('partial snapshots and read watermarks stay safe', () => {
  assert.match(prefix, /可能附带【本次消息快照】/);
  assert.match(prefix, /partial=true/);
  assert.match(prefix, /afterSeq=readThroughSeq/);
  assert.match(prefix, /readThroughSeq 是桥接本地.*seq.*不是 QQ messageId/);
  assert.match(prefix, /没有可靠水位.*不补造/);
  assert.match(prefix, /首次进入会话、角色变化.*qq_get_prompt/);
});

test('closing confirms only read data after the group conversation window', () => {
  assert.match(prefix, /qq_mark_read\(throughSeq=/);
  assert.match(prefix, /qq_set_wake_config\(config=[^)]*throughSeq=/);
  assert.match(prefix, /无需先重复 mark_read/);
  assert.match(prefix, /【群聊回复后】.*timeoutMs=conversationIdleMs/);
  assert.match(prefix, /【私聊沉睡前】.*timeoutMs=300000/);
  assert.match(prefix, /preSleepWaitRemainingMs.*实际剩余要求/);
});

test('private reply timing and group hard limits are distinguished', () => {
  assert.match(prefix, /【私聊首答前】.*purpose="reply", quietMs=10000/);
  assert.match(prefix, /读取和思考经过的时间也算/);
  assert.match(prefix, /【私聊等下文】.*purpose="messages"/);
  assert.match(prefix, /【每次回应预算】.*最多三条/);
  assert.match(prefix, /至少冷却两分钟/);
  assert.match(prefix, /哥哥真实艾特.*绕过主动冷却/);
});

test('visual, forwarding, sticker, voice and web capability contracts remain', () => {
  for (const text of ['不会自动发送到 QQ', 'qq_get_message_images', 'qq_get_forward_msg',
    'qq_send_poke', 'qq_list_stickers', 'qq_get_sticker_image', 'qq_send_sticker',
    'qq_collect_sticker', 'qq_sticker_note', 'qq_get_self_image', 'qq_set_sticker_remark',
    'qq_list_voices', 'qq_send_voice', 'verified=true', 'web_search', 'web_fetch']) {
    assert.ok(prefix.includes(text), 'missing capability: '+text);
  }
  assert.match(prefix, /qq_set_sticker_remark.*管理端明确启用/);
  assert.match(prefix, /不假装已发送/);
  assert.match(prefix, /qq_send_sticker 每条一张/);
});

test('safe identity, offpeak autonomy and JSON formatting remain explicit', () => {
  for (const text of ['ownerQQ', '可信', '半价时段', '09:00—12:00', '14:00—18:00',
    'anyMessage=false', '0.05', '作为 token 参数传入', 'qq_memory_append',
    'qq_memory_query', 'qq_slang_query', 'qq_slang_submit', '不重复提交', '[SILENT]']) {
    assert.ok(prefix.includes(text),'missing rule: '+text);
  }
  assert.match(prefix, /其他人的.*艾特.*选择性回应/);
  assert.match(prefix, /【工具参数 JSON 格式】.*完整、合法的 JSON 对象/);
  assert.match(prefix, /字符串值必须使用英文双引号/);
});

test('friendly role expression does not encourage hostile anti-AI tactics', () => {
  assert.match(prefix, /【反 AI 味：自然、具体、友善】/);
  assert.match(prefix, /不鼓励怼人、阴阳、故意装傻/);
  assert.doesNotMatch(prefix, /可以先装傻、打岔、阴阳/);
  assert.doesNotMatch(prefix, /允许“装唐装傻”/);
  const runtime=fs.readFileSync(new URL('../src/bridge.js',import.meta.url),'utf8');
  assert.doesNotMatch(runtime, /const antiAiLine = '【反AI味】你不是客服/);
});
console.log('reserved2 persona prefix:',prefix.length,'characters');
