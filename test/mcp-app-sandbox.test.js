const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const hostDependency = require('../dev-playground/package.json').dependencies['@genispace/mcp-app-host'];
const release = require(path.join(path.dirname(path.resolve(__dirname, '../dev-playground', hostDependency.slice('file:'.length))), 'release.json'));

test('local standard sandbox serves the Host origin query, immutable bytes and strict real HTTP headers', async () => {
  const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0,'127.0.0.1',resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const process = spawn(global.process.execPath, ['scripts/serve-sandbox.mjs'], {
    cwd: path.resolve(__dirname,'../dev-playground'), env: { ...global.process.env, MCP_APPS_SANDBOX_PORT: String(port) }, stdio: ['ignore','pipe','pipe'] });
  const exited = new Promise(resolve => process.once('exit', resolve));
  try {
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Local sandbox startup timed out')),5000);
      process.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      process.once('exit', () => { clearTimeout(timer); reject(new Error('Local sandbox did not start')); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/sandbox.html?hostOrigin=http%3A%2F%2F127.0.0.1%3A18080`);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/text\/html/);
    const html = await response.text();
    assert.equal(crypto.createHash('sha256').update(html).digest('hex'),release.sandboxSha256);
    assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
    assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.doesNotMatch(response.headers.get('content-security-policy'),/unsafe-eval/);
    assert.match(response.headers.get('permissions-policy'),/camera=\(\),microphone=\(\),geolocation=\(\)/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/unrelated`)).status,404);
  } finally { process.kill('SIGTERM'); await exited; }
});
