/* Deterministic, self-contained resources: no runtime CDN or module loader. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const catalog = require('./catalog.json');
const css = `:root{font-family:var(--font-sans,ui-sans-serif,system-ui,sans-serif);color-scheme:light dark;color:var(--color-text-primary,#202020);background:transparent}*{box-sizing:border-box}body{margin:0;padding:12px;font-size:14px;line-height:1.5}[hidden]{display:none!important}button,input,select{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--color-ring-primary,#767676);outline-offset:3px}button:active{transform:scale(.98)}.app-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:var(--color-text-secondary,#707070);font-size:12px}.app-toolbar button{border:1px solid var(--color-border-primary,#ddd);border-radius:7px;padding:4px 9px;color:inherit;background:transparent}.app-placeholder{color:var(--color-text-secondary,#707070)}[data-theme=dark]{color-scheme:dark;color:#e8e8e8}.local-preview{padding:16px;border:1px solid var(--color-border-primary,#ddd);border-radius:12px}.local-preview dl{display:grid;grid-template-columns:max-content 1fr;gap:8px 20px}.local-preview dd{margin:0;overflow-wrap:anywhere}.local-preview small{display:block;color:var(--color-text-secondary,#777);margin-top:16px}@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;
async function buildApps() {
  const output = path.join(root, 'public/mcp-apps');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  const resources = [];
  for (const item of catalog) {
    const directory = path.join(root, item.directory);
    const meta = JSON.parse(await fs.readFile(path.join(directory, 'app.json'), 'utf8'));
    const result = await esbuild.build({ entryPoints: [path.join(directory, 'entry.jsx')], bundle: true,
      loader: { '.js': 'jsx' }, write: false, format: 'iife', platform: 'browser', target: ['es2022'], minify: true,
      nodePaths: [path.join(__dirname, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof' });
    const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
    const title = meta.title.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>' + css + '</style></head><body><div id="root"></div><script>' + script + '</script></body></html>';
    const relative = item.id + '/view.html';
    await fs.mkdir(path.join(output, item.id), { recursive: true });
    await fs.writeFile(path.join(output, relative), html);
    resources.push({ ...item, ...meta, file: 'public/mcp-apps/' + relative,
      mimeType: 'text/html;profile=mcp-app', sha256: crypto.createHash('sha256').update(html).digest('hex') });
  }
  await fs.writeFile(path.join(output, 'resources.json'), JSON.stringify({ schemaVersion: 1, repository: require('../package.json').name, resources }, null, 2) + '\n');
  return resources;
}
if (require.main === module) buildApps().then(items => console.log(`Built ${items.length} standard MCP Apps`)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildApps };
