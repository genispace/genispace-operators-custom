"use strict";
/** Resolve the method-owned view against the service's trusted public base,
 * retaining its ingress prefix. This does not publish or register an asset. */
function attachViews(methods, base) {
  return methods.map(method => {
    if (!method.view) return method;
    const url = method.view.url;
    if (typeof url !== 'string' || !url || /[\\]/.test(url)) throw new Error('MCP_VIEW_URL_INVALID');
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
    if (!absolute && (!url.startsWith('./static/mcp-apps/') || url.split('/').includes('..') || /[?#%]/.test(url))) throw new Error('MCP_VIEW_URL_INVALID');
    const resolved = new URL(url, String(base).replace(/\/$/, '') + '/');
    if (!['http:', 'https:'].includes(resolved.protocol) || resolved.username || resolved.password || resolved.hash) throw new Error('MCP_VIEW_URL_INVALID');
    return { ...method, view: { ...method.view, url: resolved.href } };
  });
}
module.exports = { attachViews };
