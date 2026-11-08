"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readManifest, resolveAppBinding } = require('../src/services/mcp-app-bindings');
const catalog = require('./catalog.json');
function validate(options = {}) {
  const manifest = readManifest(options);
  const root = path.resolve(__dirname, '..');
  for (const app of catalog) {
    for (const method of app.methods) {
      if (!resolveAppBinding(app.operatorIdentifier, method, { app: app.id, entryKey: 'view' }, manifest)) throw new Error('MCP_APP_NOT_PUBLISHED: ' + app.operatorIdentifier + '/' + method);
    }
    const html = fs.readFileSync(path.join(root, 'public/mcp-apps', app.id, 'view.html'));
    if (crypto.createHash('sha256').update(html).digest('hex') !== manifest.apps[app.id].sha256) throw new Error('MCP_APP_BUILD_HASH_MISMATCH: ' + app.id);
  }
  return catalog.length;
}
if (require.main === module) {
  try { console.log('Validated ' + validate() + ' published MCP Apps'); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validate };
