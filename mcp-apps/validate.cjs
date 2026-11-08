"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const catalog = require('./catalog.json');
function validate() {
  const root = path.resolve(__dirname, '..');
  const resources = JSON.parse(fs.readFileSync(path.join(root, 'public/mcp-apps/resources.json'), 'utf8')).resources;
  for (const app of catalog) {
    const html = fs.readFileSync(path.join(root, 'public/mcp-apps', app.id, 'view.html'));
    if (!html.length || crypto.createHash('sha256').update(html).digest('hex') !== resources.find(item => item.id === app.id)?.sha256) throw new Error('MCP_VIEW_BUILD_HASH_MISMATCH');
  }
  return catalog.length;
}
if (require.main === module) { try { console.log('Validated ' + validate() + ' method views'); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { validate };
