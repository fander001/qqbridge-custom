import fs from 'node:fs';
import path from 'node:path';

export function resolveInstalledPreset(name, {root, home}) {
  const bundle = path.resolve(root, '..', 'plugins', 'qq-agent-presets', 'presets', name + '.patch.yml');
  if (fs.existsSync(bundle)) return bundle;
  const standard = path.join(home, 'plugins', 'qq-agent-presets', 'presets', name + '.patch.yml');
  if (fs.existsSync(standard)) return standard;
  return path.join(home, '.agent-presets', name, 'agent.cordis.yml');
}
export function synchronizePreset(name, target, {knownPresetName, sourceFor, renderPatch, writeText}) {
  if (!knownPresetName(name)) throw new Error('Unknown preset');
  if (!fs.existsSync(target)) return { synced: false, changed: false };
  const text = target.endsWith('.patch.yml') ? renderPatch(name) : fs.readFileSync(sourceFor(name), 'utf8');
  const changed = fs.readFileSync(target, 'utf8') !== text;
  if (changed) writeText(target, text);
  return { synced: true, changed };
}
