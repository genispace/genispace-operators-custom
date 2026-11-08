"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const Module = require('node:module');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const uiRequire = Module.createRequire(path.join(root, 'mcp-apps/package.json'));
const React = uiRequire('react');
const { renderToStaticMarkup } = uiRequire('react-dom/server');
const esbuild = uiRequire('esbuild');
const { buildApps } = require('../mcp-apps/build.cjs');
const { resolveAppBinding, attachBindings, resolvePublications } = require('../src/services/mcp-app-bindings');
const catalog = require('../mcp-apps/catalog.json');
const uuid = '11111111-1111-4111-8111-111111111111';
function fixture(app) {
  if (app === 'weather-forecast') return { ok: true, location: { name: 'Fixture City' }, current: { temperature: 29, apparent_temperature: 28, weather_code: 0 }, daily: [] };
  if (app === 'tavily-search') return { query: 'Fixture search', search_results: [{ sources: [{ title: 'Fixture source', url: 'https://example.test/doc', snippet: 'Verified search result' }] }] };
  if (app === 'travel-application-query') return { ok: true, normalized: [{ bill_no: 'Fixture travel', applicant: 'Fixture person' }], total: 1 };
  if (app === 'reimbursement-platform-user-info') return { ok: true, userInfo: { name: 'Fixture person', tenantName: 'Fixture tenant', orgName: 'Fixture org', email: 'fixture@example.test' } };
  if (app === 'domestic-travel-expense-claim') return { ok: true, basic_info: { applicant: 'Fixture person', document_number: '12345678' }, itinerary_rows: [], payment_rows: [] };
  if (app === 'chinese-e-invoice') return { invoice_number: 'Fixture invoice', buyer_name: 'Fixture buyer', invoice_title: 'Electronic Invoice' };
  return { ok: true, stage: 'travel_expense_apply_preview', draft_id: 'Fixture draft', message: 'Fixture preview' };
}
async function component(filename) {
  const bundle = await esbuild.build({ entryPoints: [filename], bundle: true, write: false, format: 'cjs', platform: 'node', loader: { '.js': 'jsx' },
    external: ['react','react-dom','lucide-react'], nodePaths: [path.join(root, 'mcp-apps/node_modules')] });
  const compiled = new Module(filename); compiled.paths = Module._nodeModulePaths(path.join(root, 'mcp-apps'));
  compiled._compile(bundle.outputFiles[0].text, filename);
  return compiled.exports.default;
}

test('all declared resources deterministically bundle the official SDK, own React and locales', async () => {
  const first = await buildApps();
  const second = await buildApps();
  assert.equal(first.length, catalog.length);
  assert.deepEqual(first.map(item => item.sha256), second.map(item => item.sha256));
  for (const item of first) {
    const bytes = await fs.readFile(path.join(root, item.file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.match(bytes.toString(), /^<!doctype html>/);
    assert.equal(item.mimeType, 'text/html;profile=mcp-app');
    assert.doesNotMatch(bytes.toString(), /<script[^>]+src=|<link[^>]+href=|__gsPlugin|__PLUGIN_I18N|new Function/);
    assert.deepEqual(item.permissions, {});
  }
});

test('standard result/input/context notifications render current business data in detail and summary', async () => {
  const { toolResultProps } = await import('../mcp-apps/protocol.mjs');
  for (const app of catalog) {
    const data = fixture(app.id);
    const props = toolResultProps({ content: [], structuredContent: data }, { account: 'Fixture account' }, { locale: 'en-US', theme: 'dark' });
    const definition = JSON.parse(await fs.readFile(path.join(root, app.directory, 'app.json'), 'utf8'));
    for (const view of ['detail.js', ...(definition.summary ? ['summary.js'] : [])]) {
      const Component = await component(path.join(root, app.directory, view));
      const markup = renderToStaticMarkup(React.createElement(Component, props));
      assert.match(markup, /Fixture|29°|12345678/, app.id + '/' + view);
      assert.doesNotMatch(markup, /__gsPlugin|undefined/);
    }
  }
});

test('connection handlers do not execute business tools; dimensions and locale are standard Host context', async () => {
  const { connectView, compactPresentation, availableHeight, toolResultProps } = await import('../mcp-apps/protocol.mjs');
  let businessCalls = 0; const snapshots = [];
  const app = { connect: async () => {}, getHostContext: () => ({ locale: 'zh-CN', theme: 'dark', containerDimensions: { maxHeight: 240 } }), callServerTool: () => businessCalls++ };
  await connectView(app, value => snapshots.push(value));
  app.ontoolinput({ arguments: { q: 'input' } });
  app.ontoolresult({ content: [{ type: 'text', text: '{"value":7}' }] });
  app.onhostcontextchanged({});
  assert.equal(businessCalls, 0);
  assert.deepEqual(snapshots.at(-1).arguments, { q: 'input' });
  assert.equal(toolResultProps(snapshots.at(-1).result).data.value, 7);
  assert.equal(toolResultProps({ isError: true, content: [] }).success, false);
  assert.equal(compactPresentation(snapshots.at(-1).context), true);
  assert.equal(compactPresentation({ containerDimensions: { maxHeight: 560 } }), false);
  assert.equal(compactPresentation({ displayMode: 'fullscreen' }), false);
  assert.equal(availableHeight({ containerDimensions: { height: 500, maxHeight: 240 } }), 500);
});

test('missing publication keeps business methods; strict publication validation fails instead of inventing bindings', async () => {
  const item = catalog[0];
  const config = { info: { name: item.operatorIdentifier }, mcpAppsByMethod: { [item.methods[0]]: { app: item.id, entryKey: 'view' } } };
  const method = { identifier: item.methods[0], inputSchema: { type: 'object' } };
  assert.deepEqual(attachBindings([method], config, { filename: null }), [method]);
  assert.equal(resolvePublications(config, { filename: null })[0].binding, null);
  const { validate } = require('../mcp-apps/validate.cjs');
  assert.throws(() => validate({ filename: null }), /MCP_APP_NOT_PUBLISHED/);
});

test('environment manifests bind shared methods to one real release and reject foreign or malformed publication', async () => {
  const app = catalog.at(-1); const method = app.methods[0]; const declaration = { app: app.id, entryKey: 'view' };
  const binding = { releaseId: uuid, entryKey: 'view', visibility: ['model','app'] };
  const manifest = { schemaVersion: 1, environment: 'http://localhost:3000/api', apps: { [app.id]: { ...binding, sha256: 'a'.repeat(64) } }, bindings: { [app.operatorIdentifier]: { [method]: binding } } };
  assert.deepEqual(resolveAppBinding(app.operatorIdentifier, method, declaration, manifest), binding);
  assert.throws(() => resolveAppBinding(app.operatorIdentifier, method, declaration, { ...manifest, apps: {} }), /MCP_APP_BINDING_INVALID/);
  assert.throws(() => resolveAppBinding(app.operatorIdentifier, 'not-declared', declaration, manifest), /MCP_APP_DECLARATION_INVALID/);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-app-binding-'));
  try { const filename = path.join(dir,'binding.json'); await fs.writeFile(filename, JSON.stringify(manifest));
    const { readManifest } = require('../src/services/mcp-app-bindings');
    assert.deepEqual(readManifest({ filename, environment: 'http://localhost:3000/api/' }), manifest);
    assert.throws(() => readManifest({ filename, environment: 'https://other.example/api' }), /MCP_APP_ENVIRONMENT_MISMATCH/);
  } finally { await fs.rm(dir,{ recursive: true, force: true }); }
});

test('publisher uses exact built bytes and standard release API, then persists real method binding IDs', async () => {
  const requests = []; const directory = await fs.mkdtemp(path.join(os.tmpdir(),'mcp-app-publish-'));
  const server = http.createServer(async (request,response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    requests.push({ path: request.url, type: request.headers['content-type'], body: Buffer.concat(chunks) });
    response.setHeader('content-type','application/json');
    response.end(JSON.stringify({ success: true, data: { id: request.url.includes('/storage/') ? 'file-fixture' : uuid } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { publish } = require('../mcp-apps/publish.cjs');
    const result = await publish({ api: `http://127.0.0.1:${server.address().port}/api`, output: path.join(directory,'bindings.json'), global: true },
      { token: 'fixture-only', git: (...args) => args[0] === 'rev-parse' ? 'a'.repeat(40) : args[0] === 'status' ? '' : 'https://github.com/genispace/fixture.git' });
    assert.equal(requests.length, catalog.length * 2);
    for (const app of catalog) assert.equal(result.bindings[app.operatorIdentifier][app.methods[0]].releaseId, uuid);
    const release = JSON.parse(requests[1].body);
    assert.equal(release.entries[0].mimeType,'text/html;profile=mcp-app');
    assert.equal(release.entries[0].key,'view');
    assert.equal(release.sourceRevision,'a'.repeat(40));
    assert.equal(release.global,true);
    assert.equal(release.entries[0].sha256,result.apps[catalog[0].id].sha256);
    assert.match(requests[0].type,/multipart\/form-data/);
    assert.match(requests[0].body.toString(),/<!doctype html>/);
    assert.ok(requests[0].body.toString().includes(release.entries[0].sha256 + '.html'));
    await assert.rejects(publish({ api: 'http://localhost:3000/api' }), /--api and --output are required/);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory,'bindings.json'),'utf8')),result);
  } finally { await new Promise(resolve => server.close(resolve)); await fs.rm(directory,{recursive:true,force:true}); }
});
