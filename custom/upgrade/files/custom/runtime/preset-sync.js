import fs from 'node:fs';
import path from 'node:path';
import { resolveInstalledPreset as resolveUpstreamPreset } from '../../src/preset-sync.js';
export { synchronizePreset } from '../../src/preset-sync.js';

export function resolveInstalledPreset(name, {root, home, knownPresetName = name => ['qq-chat', 'qq-chat-v2'].includes(name)}) {
  if (!knownPresetName(name)) throw new Error('Unknown preset');
  if (root) {
    const bundle = path.resolve(root, '..', 'plugins', 'qq-agent-presets', 'presets', name + '.patch.yml');
    if (fs.existsSync(bundle)) return bundle;
  }
  return resolveUpstreamPreset(name, {home, knownPresetName});
}
