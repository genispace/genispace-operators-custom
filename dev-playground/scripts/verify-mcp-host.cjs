"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const revision = 'cd4385055034e5c10560c3bd521d7c8dec4061ee';
const directory = path.join(root, 'vendor/mcp-app-host', revision);
const release = JSON.parse(fs.readFileSync(path.join(directory, 'release.json'), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (release.package !== '@genispace/mcp-app-host' || release.sourceRevision !== revision ||
    release.protocolVersion !== '2026-01-26' || release.sha256 !== '9e70cc7861800da4f2cd3c3d4303f8784d946f0cc776ee036a556482b5bef8b9' ||
    sha256(fs.readFileSync(path.join(directory, release.artifact))) !== release.sha256) throw new Error('MCP Host artifact verification failed');
const installed = path.join(root, 'node_modules/@genispace/mcp-app-host/dist/sandbox');
if (sha256(fs.readFileSync(path.join(installed, 'sandbox.html'))) !== release.sandboxSha256) throw new Error('Installed MCP sandbox differs from its release');
console.log('Verified immutable MCP Host ' + revision);
