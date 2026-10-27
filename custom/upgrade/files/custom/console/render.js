import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(new URL('./patches.json', import.meta.url), 'utf8'));

/** Compose custom controls without editing upstream HTML. Unknown anchors fail visibly. */
export function renderCustomizedConsole(input) {
  let html = String(input).replace(/\r\n/g, '\n');
  for (const operation of manifest.operations) {
    const at = html.indexOf(operation.before);
    if (at < 0 || html.indexOf(operation.before, at + 1) >= 0) {
      throw new Error('QQ Bridge custom console anchor conflict: ' + operation.id);
    }
    const fragment = fs.readFileSync(new URL(operation.fragment, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    html = html.slice(0, at) + fragment + html.slice(at + operation.before.length);
  }
  return html;
}
export function readCustomizedConsole(file = new URL('../../public/console.html', import.meta.url)) {
  return renderCustomizedConsole(fs.readFileSync(file, 'utf8'));
}
