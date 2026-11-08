import http from 'node:http';
import { sandboxHtml, buildSandboxCsp } from '@genispace/mcp-app-host/sandbox';
const port = Number(process.env.MCP_APPS_SANDBOX_PORT || 5017);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid sandbox port');
const server = http.createServer((request, response) => {
  if (request.url !== '/sandbox.html') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': buildSandboxCsp({}, true), 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(),microphone=(),geolocation=(),clipboard-write=()' });
  response.end(sandboxHtml);
});
server.listen(port, '127.0.0.1', () => console.log('Local MCP App sandbox listening on 127.0.0.1:' + port));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close());
