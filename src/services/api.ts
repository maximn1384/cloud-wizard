import { acquireDataverseToken } from './auth';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: optHeaders, ...rest } = options ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(optHeaders as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Build Authorization header for Dataverse-bound requests.
 */
async function authHeaders(orgUrl: string): Promise<Record<string, string>> {
  const token = await acquireDataverseToken(orgUrl);
  if (!token) throw new Error('Not authenticated — please sign in');
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  // Runs
  listRuns: () => request<import('../types/run').Run[]>('/runs'),
  getRun: (id: string) => request<import('../types/run').Run>(`/runs/${id}`),
  createRun: (name: string) =>
    request<import('../types/run').Run>('/runs', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateRun: (id: string, data: Record<string, unknown>) =>
    request<import('../types/run').Run>(`/runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Environment (requires auth token for Dataverse)
  testConnection: async (runId: string, url: string) => {
    const headers = await authHeaders(url);
    return request<{ valid: boolean; tables?: string[]; error?: string }>(
      `/mcp/test-connection`,
      { method: 'POST', body: JSON.stringify({ runId, url }), headers }
    );
  },

  // Upload
  uploadFiles: async (runId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const res = await fetch(`${API_BASE}/upload/${runId}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json() as Promise<import('../types/run').SourceFile[]>;
  },

  // Analysis
  analyze: (runId: string, feedback?: string) =>
    request<import('../types/run').RunVersion>(`/ai/analyze/${runId}`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  // Solution Design
  design: (runId: string, guidance?: string) =>
    request<import('../types/run').RunVersion>(`/ai/design/${runId}`, {
      method: 'POST',
      body: JSON.stringify({ guidance }),
    }),

  // Approval
  approve: (runId: string, versionId: string, approvedBy?: string) =>
    request<import('../types/run').Approval>(
      `/runs/${runId}/versions/${versionId}/approve`,
      { method: 'POST', body: JSON.stringify({ approvedBy }) }
    ),

  // Generation (Builder agent — SSE streaming with MCP execution)
  generateStream: (
    runId: string,
    orgUrl: string,
    onDelta: (text: string) => void,
    onDone: () => void,
    onError: (error: string) => void
  ) => {
    const controller = new AbortController();
    // Get Dataverse token for MCP calls, then start the stream
    acquireDataverseToken(orgUrl).then((token) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(`${API_BASE}/ai/generate/${runId}`, {
        method: 'POST',
        headers,
        signal: controller.signal,
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text();
          onError(`API ${res.status}: ${body}`);
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) {
          onError('No response stream');
          return;
        }
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'delta') onDelta(event.text);
              else if (event.type === 'done') onDone();
              else if (event.type === 'error') onError(event.error);
            } catch {
              // skip malformed lines
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          onError(err instanceof Error ? err.message : 'Stream failed');
        }
      });
    });
    return controller;
  },

  // Logs
  getLogs: (runId: string) =>
    request<import('../types/run').LogEntry[]>(`/runs/${runId}/logs`),
};
