import { useMemo } from 'react';
import { McpAppView } from '@genispace/mcp-app-host/react';
import type { HostPort, McpAppDescriptor, Tool, CallToolResult } from '@genispace/mcp-app-host/core';
import type { MethodRow } from './types';

/** Explicit local-only preview. No platform credential or business action reaches an App. */
export function StandardAppPreview({ method, result, args, theme, locale, height }:
  { method: MethodRow; result: unknown; args: Record<string, unknown>; theme: 'light' | 'dark'; locale: string; height: number }) {
  const preview = method.mcpAppPreview!;
  const resourceUri = 'ui://local-preview/' + preview.app + '/view.html';
  const descriptor = useMemo<McpAppDescriptor>(() => {
    const tool: Tool = { name: method.identifier, description: method.description,
      inputSchema: { ...method.inputSchema, type: 'object' } as Tool['inputSchema'], _meta: { ui: { resourceUri } } };
    const output: CallToolResult = { content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: (result && typeof result === 'object' ? result : { value: result }) as Record<string, unknown>,
      isError: Boolean(result && typeof result === 'object' && 'success' in result && result.success === false) };
    return { schemaVersion: 1, kind: 'mcp-app', serverIdentity: window.location.origin,
      principalId: 'local-developer', environment: 'local-preview', sessionId: 'local-preview',
      threadId: 'local-preview', messageId: crypto.randomUUID(), toolCallId: crypto.randomUUID(),
      tool, arguments: args, result: output, resourceUri, readOnly: true };
  }, [args, method, resourceUri, result]);
  const port = useMemo<HostPort>(() => ({
    scope: { serverIdentity: window.location.origin, principalId: 'local-developer', environment: 'local-preview',
      sessionId: 'local-preview', toolsEnabled: false, readOnly: true },
    async readResource(uri, { signal }) {
      if (uri !== resourceUri || !/^\/static\/mcp-apps\/[a-z0-9-]+\/view\.html$/.test(preview.resourcePath)) throw new Error('Preview resource not allowed');
      const response = await fetch(preview.resourcePath, { signal, credentials: 'omit', redirect: 'error' });
      if (!response.ok) throw new Error('Build the MCP App resources before previewing');
      return { contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: await response.text(), _meta: { ui: { csp: {}, permissions: {} } } }] };
    },
    async listTools() { return []; }, async authorizeToolCall() { return false; },
    async callTool() { throw new Error('Local preview does not execute tools'); },
    async openLink() { throw new Error('Links are disabled in local preview'); },
  }), [preview.resourcePath, resourceUri]);
  const context = useMemo(() => ({ theme, locale, displayMode: 'inline' as const,
    availableDisplayModes: ['inline'] as ['inline'], containerDimensions: { maxHeight: height, maxWidth: 1200 } }), [theme, locale, height]);
  return <div style={{ height }}><McpAppView descriptor={descriptor} port={port} context={context}
    sandboxUrl={import.meta.env.VITE_MCP_APP_SANDBOX_URL || 'http://127.0.0.1:5021/sandbox.html'}
    title={method.name} className="h-full w-full border-0" /></div>;
}
