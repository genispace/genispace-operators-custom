"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const uiRequire = Module.createRequire(path.join(root, 'mcp-apps/package.json'));
const React = uiRequire('react');
const { renderToStaticMarkup } = uiRequire('react-dom/server');
const esbuild = uiRequire('esbuild');
const { buildApps } = require('../mcp-apps/build.cjs');
const { attachViews } = require('../src/services/method-views');
const catalog = require('../mcp-apps/catalog.json');
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

test('method view resolves with the ingress prefix and needs no publication', async () => {
  const method = { identifier: 'query', view: { url: './static/mcp-apps/weather-forecast/view.html' } };
  assert.equal(attachViews([method], 'https://tools.example/operators/internal')[0].view.url, 'https://tools.example/operators/internal/static/mcp-apps/weather-forecast/view.html');
  assert.deepEqual(attachViews([{ identifier: 'plain' }], 'https://tools.example/'), [{ identifier: 'plain' }]);
  for (const url of ['../secret', '//evil.test/view.html', './static/mcp-apps/../secret', 'javascript:alert(1)', 'https://user:pass@tools.example/view.html']) {
    assert.throws(() => attachViews([{ ...method, view: { url } }], 'https://tools.example/'), /MCP_VIEW_URL_INVALID/);
  }
  const { validate } = require('../mcp-apps/validate.cjs');
  await buildApps(); assert.equal(validate(), catalog.length);
});

test('actual official Apps handshake declares the implemented inline and fullscreen modes without business calls', async t => {
  const { createStandardApp } = await import('../mcp-apps/protocol.mjs');
  const { App } = await import(uiRequire.resolve('@modelcontextprotocol/ext-apps'));
  const { AppBridge } = await import(uiRequire.resolve('@modelcontextprotocol/ext-apps/app-bridge'));
  const { InMemoryTransport } = await import(uiRequire.resolve('@modelcontextprotocol/sdk/inMemory.js'));
  const app = createStandardApp(App, 'Asset contract', { autoResize: false });
  const bridge = new AppBridge(null, { name: 'Independent test Host', version: '1' }, {});
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await app.close(); await bridge.close(); });
  await bridge.connect(hostTransport);
  await app.connect(appTransport);
  assert.deepEqual(bridge.getAppCapabilities().availableDisplayModes, ['inline', 'fullscreen']);
  assert.equal(app.getHostCapabilities().serverTools, undefined);
});
