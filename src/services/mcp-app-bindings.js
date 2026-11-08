"use strict";
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../../mcp-apps/catalog.json');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function normalizedEnvironment(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('MCP_APP_ENVIRONMENT_INVALID');
  return url.href.replace(/\/$/, '');
}
function readManifest(options = {}) {
  const filename = options.filename ?? process.env.MCP_APP_BINDINGS_FILE;
  if (!filename) return null;
  const manifest = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
  const environment = options.environment ?? process.env.MCP_APP_API_BASE_URL;
  if (!environment || manifest.schemaVersion !== 1 || normalizedEnvironment(manifest.environment) !== normalizedEnvironment(environment)) throw new Error('MCP_APP_ENVIRONMENT_MISMATCH');
  return manifest;
}
function resolveAppBinding(operator, method, declaration, manifest) {
  if (!declaration) return null;
  const app = catalog.find(item => item.id === declaration.app && item.operatorIdentifier === operator && item.methods.includes(method));
  if (!app || declaration.entryKey !== 'view') throw new Error('MCP_APP_DECLARATION_INVALID');
  const binding = manifest?.bindings?.[operator]?.[method];
  if (!binding) return null;
  const published = manifest.apps?.[declaration.app];
  const visibility = binding.visibility ?? ['model', 'app'];
  if (!UUID.test(binding.releaseId || '') || binding.entryKey !== declaration.entryKey ||
      published?.releaseId !== binding.releaseId || published?.entryKey !== binding.entryKey ||
      !/^[a-f0-9]{64}$/.test(published?.sha256 || '') || !Array.isArray(visibility) || !visibility.length ||
      visibility.some(value => !['model', 'app'].includes(value)) || new Set(visibility).size !== visibility.length) throw new Error('MCP_APP_BINDING_INVALID');
  return { releaseId: binding.releaseId, entryKey: binding.entryKey, visibility };
}
function resolvePublications(config, options = {}) {
  const operator = config.info.name;
  const declarations = config.mcpAppsByMethod || {};
  const manifest = readManifest(options);
  return Object.entries(declarations).map(([method, declaration]) => ({ method, app: declaration.app,
    binding: resolveAppBinding(operator, method, declaration, manifest),
    preview: { app: declaration.app, entryKey: declaration.entryKey,
      resourcePath: '/static/mcp-apps/' + declaration.app + '/view.html' } }));
}
function attachBindings(methods, config, options = {}) {
  const publications = resolvePublications(config, options);
  return methods.map(method => {
    const publication = publications.find(item => item.method === method.identifier);
    return publication?.binding ? { ...method, mcpAppBinding: publication.binding } : method;
  });
}
module.exports = { normalizedEnvironment, readManifest, resolveAppBinding, resolvePublications, attachBindings };
