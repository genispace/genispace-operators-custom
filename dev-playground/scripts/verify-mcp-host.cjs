"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const revision = '69125948380bce2a1ca4134718276f65a7650ea4';
const directory = path.join(root, 'vendor/mcp-app-host', revision);
const release = JSON.parse(fs.readFileSync(path.join(directory, 'release.json'), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (release.package !== '@genispace/mcp-app-host' || release.sourceRevision !== revision ||
    release.protocolVersion !== '2026-01-26' || release.sha256 !== '910037d0dfaf50e524779c377925e6d68c3b995508eb9802971c6e99983d21a0' ||
    sha256(fs.readFileSync(path.join(directory, release.artifact))) !== release.sha256) throw new Error('MCP Host artifact verification failed');
const installed = path.join(root, 'node_modules/@genispace/mcp-app-host/dist/sandbox');
if (sha256(fs.readFileSync(path.join(installed, 'sandbox.html'))) !== release.sandboxSha256) throw new Error('Installed MCP sandbox differs from its release');
console.log('Verified immutable MCP Host ' + revision);
