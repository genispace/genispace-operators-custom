"use strict";
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { normalizedEnvironment } = require('../src/services/mcp-app-bindings');
const root = path.resolve(__dirname, '..');
function parseOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--global') options.global = true;
    else if (['--api', '--output'].includes(argv[i]) && argv[i+1]) options[argv[i].slice(2)] = argv[++i];
    else throw new Error('Usage: publish.cjs --api <API base URL> --output <binding manifest> [--global]');
  }
  return options;
}
function repositoryUrl(raw) {
  const source = raw.trim().replace(/^git@github.com:/, 'https://github.com/').replace(/\.git$/, '');
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('MCP_APP_SOURCE_INVALID');
  return url.href;
}
async function publish(options, dependencies = {}) {
  const api = normalizedEnvironment(options.api);
  const parsed = new URL(api);
  if (parsed.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)) throw new Error('MCP_APP_HTTPS_REQUIRED');
  const token = dependencies.token ?? process.env.GENISPACE_API_KEY;
  if (!token) throw new Error('GENISPACE_API_KEY is required');
  const request = dependencies.fetch ?? fetch;
  async function post(suffix, body, multipart = false) {
    const response = await request(api + suffix, { method: 'POST', redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
      body: multipart ? body : JSON.stringify(body) });
    let envelope; try { envelope = await response.json(); } catch { throw new Error('MCP_APP_PUBLISH_RESPONSE_INVALID'); }
    if (!response.ok || envelope?.success !== true || !envelope.data) throw new Error('MCP_APP_PUBLISH_FAILED_HTTP_' + response.status);
    return envelope.data;
  }
  const git = dependencies.git ?? ((...args) => execFileSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8' }).trim());
  const sourceRevision = git('rev-parse', 'HEAD');
  if (!/^[a-f0-9]{40,64}$/.test(sourceRevision)) throw new Error('MCP_APP_REVISION_INVALID');
  if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('MCP_APP_SOURCE_NOT_COMMITTED');
  const sourceRepository = repositoryUrl(git('remote', 'get-url', 'origin'));
  const build = JSON.parse(await fs.readFile(path.join(root, 'public/mcp-apps/resources.json'), 'utf8'));
  const manifest = { schemaVersion: 1, environment: api, sourceRepository, sourceRevision, apps: {}, bindings: {} };
  for (const app of build.resources) {
    const bytes = await fs.readFile(path.join(root, app.file));
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== app.sha256) throw new Error('MCP_APP_BUILD_HASH_MISMATCH');
    const form = new FormData(); form.append('file', new Blob([bytes], { type: app.mimeType }), app.id + '.html');
    const uploaded = await post('/storage/files/upload', form, true);
    if (typeof uploaded.id !== 'string') throw new Error('MCP_APP_UPLOAD_ID_MISSING');
    const release = await post('/mcp/apps/releases', { name: build.repository + '/' + app.id,
      version: app.version, sourceRepository, sourceRevision, global: options.global === true,
      entries: [{ key: app.entryKey, storageFileId: uploaded.id, sha256, mimeType: app.mimeType, csp: app.csp, permissions: app.permissions }] });
    if (typeof release.id !== 'string') throw new Error('MCP_APP_RELEASE_ID_MISSING');
    manifest.apps[app.id] = { releaseId: release.id, entryKey: app.entryKey, sha256 };
    manifest.bindings[app.operatorIdentifier] ||= {};
    for (const method of app.methods) manifest.bindings[app.operatorIdentifier][method] = {
      releaseId: release.id, entryKey: app.entryKey, visibility: ['model', 'app'] };
  }
  const output = path.resolve(options.output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const temporary = output + '.' + process.pid + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  await fs.rename(temporary, output);
  return manifest;
}
if (require.main === module) {
  let options;
  try { options = parseOptions(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
  if (options) publish(options).then(result => console.log('Published ' + Object.keys(result.apps).length + ' standard MCP Apps')).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { publish, parseOptions, repositoryUrl };
