"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const revision = 'e11241d9241fea8b542b99e3e09819bd76a7a7d3';
const directory = path.join(root, 'vendor/mcp-app-host', revision);
const release = JSON.parse(fs.readFileSync(path.join(directory, 'release.json'), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (release.package !== '@genispace/mcp-app-host' || release.sourceRevision !== revision ||
    release.protocolVersion !== '2026-01-26' || release.sha256 !== '3ba349636733923f90dfe0d138107373d19a42b28538755d83c322def5015da5' ||
    sha256(fs.readFileSync(path.join(directory, release.artifact))) !== release.sha256) throw new Error('MCP Host artifact verification failed');
const installed = path.join(root, 'node_modules/@genispace/mcp-app-host/dist/sandbox');
if (sha256(fs.readFileSync(path.join(installed, 'sandbox.html'))) !== release.sandboxSha256) throw new Error('Installed MCP sandbox differs from its release');
console.log('Verified immutable MCP Host ' + revision);
