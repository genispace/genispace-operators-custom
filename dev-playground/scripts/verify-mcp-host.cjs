"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const revision = 'bfa3e4e69b55173f3a006e3fd1865ab874c80c00';
const directory = path.join(root, 'vendor/mcp-app-host', revision);
const release = JSON.parse(fs.readFileSync(path.join(directory, 'release.json'), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (release.package !== '@genispace/mcp-app-host' || release.sourceRevision !== revision ||
    release.protocolVersion !== '2026-01-26' || release.sha256 !== '2b71c3ec93229aea9f408d4acd7d0a75087532a5de6601d7e6d56d91972d5760' ||
    sha256(fs.readFileSync(path.join(directory, release.artifact))) !== release.sha256) throw new Error('MCP Host artifact verification failed');
const installed = path.join(root, 'node_modules/@genispace/mcp-app-host/dist/sandbox');
if (sha256(fs.readFileSync(path.join(installed, 'sandbox.html'))) !== release.sandboxSha256) throw new Error('Installed MCP sandbox differs from its release');
console.log('Verified immutable MCP Host ' + revision);
