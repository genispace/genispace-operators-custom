import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { availableHeight, compactPresentation, connectView, toolResultProps, createStandardApp } from './protocol.mjs';

export function mountApp({ title, Detail, Summary }) {
  const app = createStandardApp(App, title);
  function View() {
    const [snapshot, setSnapshot] = useState({ result: undefined, arguments: {}, context: {} });
    const [expanded, setExpanded] = useState(false);
    const [failed, setFailed] = useState(false);
    useEffect(() => { let alive = true;
      void connectView(app, value => { if (alive) setSnapshot(value); }).catch(() => { if (alive) setFailed(true); });
      return () => { alive = false; void app.close(); };
    }, []);
    const zh = String(snapshot.context.locale || '').startsWith('zh');
    const compact = Boolean(Summary) && compactPresentation(snapshot.context) && !expanded;
    const height = availableHeight(snapshot.context);
    useEffect(() => {
      applyDocumentTheme(snapshot.context.theme || 'light');
      applyHostStyleVariables(snapshot.context.styles?.variables || {});
      document.documentElement.lang = snapshot.context.locale || 'en';
    }, [snapshot.context]);
    if (failed) return <p role="status">{zh ? '视图连接不可用' : 'View connection unavailable'}</p>;
    if (!snapshot.result) return <p role="status" className="app-placeholder">{zh ? '等待工具结果…' : 'Waiting for tool result…'}</p>;
    const props = { ...toolResultProps(snapshot.result, snapshot.arguments, snapshot.context), openLink: url => app.openLink({ url }) };
    return <section aria-label={title} style={{ maxHeight: height ? Math.max(0, height - 24) : undefined, overflow: 'auto' }}>
      {Summary && compactPresentation(snapshot.context) && <header className="app-toolbar"><span>{title}</span>
        <button type="button" aria-expanded={!compact} onClick={() => setExpanded(value => !value)}>
          {compact ? (zh ? '查看详情' : 'View details') : (zh ? '收起' : 'Collapse')}
        </button></header>}
      {Summary && <div hidden={!compact}><Summary {...props} /></div>}
      {/* Keep the detail tree mounted: draft edits survive container and Tab resizing. */}
      <div hidden={compact}><Detail {...props} /></div>
    </section>;
  }
  createRoot(document.getElementById('root')).render(<View />);
  return app;
}
