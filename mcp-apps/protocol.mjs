/** Pure standard MCP Apps projections; no network or business invocation side effects. */
export function toolResultProps(result, args = {}, context = {}) {
  let data = result?.structuredContent;
  if (data === undefined) {
    const text = (result?.content || []).find(item => item.type === 'text')?.text;
    try { data = JSON.parse(text); } catch { data = text ?? null; }
  }
  while (data?.success === true && data.data && typeof data.data === 'object') data = data.data;
  return {
    data, success: result?.isError !== true,
    error: result?.isError === true ? (String(context.locale || '').startsWith('zh') ? '工具执行失败' : 'Tool execution failed') : undefined,
    metadata: { arguments: args },
    config: { locale: context.locale || 'en', theme: context.theme || 'light' },
  };
}
export function availableHeight(context) {
  const dimensions = context?.containerDimensions || {};
  const value = dimensions.height ?? dimensions.maxHeight;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}
export function compactPresentation(context) {
  const height = availableHeight(context);
  return height !== undefined && height <= 320;
}
export function connectView(app, receive) {
  let value = { result: undefined, arguments: {}, context: {} };
  const update = patch => { value = { ...value, ...patch }; receive(value); };
  app.ontoolinput = params => update({ arguments: params.arguments || {} });
  app.ontoolresult = result => update({ result });
  app.onhostcontextchanged = () => update({ context: app.getHostContext() || {} });
  // Handlers must exist before connect: hosts may deliver inputs immediately.
  return app.connect().then(() => update({ context: app.getHostContext() || {} }));
}

/** Declare the responsive modes implemented by every resource in this build. */
export function createStandardApp(App, title, options = { autoResize: true }) {
  return new App({ name: title, version: '1.0.0' }, { availableDisplayModes: ['inline', 'fullscreen'] }, options);
}
