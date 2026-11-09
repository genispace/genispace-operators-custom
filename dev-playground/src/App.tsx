import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { useTranslation } from 'react-i18next';
import { TopNav } from './components/TopNav';
import { usePlaygroundTheme } from './hooks/usePlaygroundTheme';
import { applyLocalesToOperatorRow } from './operatorDisplayLocale';
import type { OperatorRow } from './types';
const StandardAppPreview = lazy(() => import('./StandardAppPreview').then(module => ({ default: module.StandardAppPreview })));

export default function App() {
  const { i18n } = useTranslation('playground');
  const zh = i18n.language.startsWith('zh');
  const { theme, toggleTheme } = usePlaygroundTheme();
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [opKey, setOpKey] = useState('');
  const [methodId, setMethodId] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [invocationArgs, setInvocationArgs] = useState<Record<string, unknown>>({});
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [height, setHeight] = useState(560);
  useEffect(() => { const controller = new AbortController();
    void fetch('/api/dev/playground-registry', { signal: controller.signal }).then(response => response.json()).then(body => {
      if (body.success !== true) throw new Error('Registry unavailable');
      setOperators(body.data.operators || []);
    }).catch(cause => { if (!controller.signal.aborted) setLoadErr(cause instanceof Error ? cause.message : 'Registry unavailable'); });
    return () => controller.abort();
  }, []);
  const displayOperators = useMemo(() => operators.map(item => applyLocalesToOperatorRow(item, i18n.language)), [operators, i18n.language]);
  const selectedOp = displayOperators.find(item => `${item.category}/${item.identifier}` === opKey) || null;
  const selectedMethod = selectedOp?.methods.find(item => item.identifier === methodId) || null;
  useEffect(() => { setFormData({}); setResult(null); setError(null); }, [opKey, methodId]);
  async function execute() {
    if (!selectedMethod?.endpoint || !selectedMethod.httpMethod || running) return;
    setRunning(true); setError(null); setResult(null);
    const args = structuredClone(formData); setInvocationArgs(args);
    try {
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (selectedMethod.needsGeniSpaceKey) {
        if (!apiKey.trim()) throw new Error(zh ? '请输入 GeniSpace API Key' : 'Enter a GeniSpace API key');
        headers.GeniSpace = apiKey.trim();
      }
      const response = await fetch(selectedMethod.endpoint, { method: selectedMethod.httpMethod, headers, body: JSON.stringify(args) });
      const body = await response.json(); setResult(body);
      if (!response.ok || body.success === false) setError(zh ? '工具执行失败' : 'Tool execution failed');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Execution failed'); }
    finally { setRunning(false); }
  }
  return <div className="flex min-h-screen flex-col bg-g-bg text-g-text">
    <TopNav operators={displayOperators} opKey={opKey} setOpKey={setOpKey} methodId={methodId} setMethodId={setMethodId}
      selectedOp={selectedOp} loadErr={loadErr} theme={theme} onToggleTheme={toggleTheme} />
    <main className="mx-auto grid w-full max-w-[1600px] gap-5 p-5 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.4fr)]">
      <section className="g-card overflow-hidden"><header className="border-b border-g-border px-5 py-4">
        <h1 className="text-sm font-semibold">{zh ? '请求参数' : 'Request'}</h1><p className="mt-1 text-xs text-g-muted">{selectedMethod?.description || selectedOp?.description}</p></header>
        <div className="p-5">{selectedMethod ? <>
          {selectedMethod.needsGeniSpaceKey && <label className="mb-4 block text-xs">GeniSpace API Key<input type="password" autoComplete="off" className="g-input mt-2 w-full" value={apiKey} onChange={event => setApiKey(event.target.value)} /></label>}
          <Form schema={selectedMethod.inputSchema} validator={validator} formData={formData} onChange={event => setFormData(event.formData || {})} onSubmit={() => void execute()}>
            <button type="submit" disabled={running} className="g-btn mt-4 rounded-md border border-g-border px-4 py-2 text-sm">{running ? (zh ? '执行中…' : 'Running…') : (zh ? '执行一次' : 'Run once')}</button>
          </Form></> : <p className="text-sm text-g-muted">{zh ? '选择算子与方法' : 'Choose an operator and method'}</p>}
        </div></section>
      <section className="g-card min-w-0 overflow-hidden"><header className="flex items-center justify-between border-b border-g-border px-5 py-4"><h2 className="text-sm font-semibold">{zh ? '执行结果' : 'Result'}</h2>
        {selectedMethod?.mcpAppPreview && <select aria-label={zh ? '预览高度' : 'Preview height'} className="g-select text-xs" value={height} onChange={event => setHeight(Number(event.target.value))}><option value={240}>{zh ? '行内摘要' : 'Inline summary'}</option><option value={560}>{zh ? '详情视图' : 'Detail view'}</option></select>}</header>
        <div className="p-5">{error && <p role="alert" className="mb-3 text-sm text-g-red">{error}</p>}
          {result === null ? <p className="text-sm text-g-muted">{zh ? '执行后显示结果' : 'Run to view a result'}</p> : <>
            {selectedMethod?.mcpAppPreview && <><p className="mb-3 text-xs text-g-muted">{zh ? '本地预览 · 不执行视图内工具操作' : 'Local preview · view tool actions disabled'}</p><Suspense fallback={<p className="text-xs text-g-muted">{zh ? '加载视图…' : 'Loading view…'}</p>}><StandardAppPreview method={selectedMethod} result={result} args={invocationArgs} theme={theme} locale={i18n.language} height={height} /></Suspense></>}
            <details open={!selectedMethod?.mcpAppPreview}><summary className="cursor-pointer text-xs text-g-muted">JSON</summary><pre className="g-pre mt-3 overflow-auto">{JSON.stringify(result, null, 2)}</pre></details>
          </>}
        </div></section>
    </main></div>;
}
