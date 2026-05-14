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
  analyze: (runId: string) =>
    request<import('../types/run').RunVersion>(`/ai/analyze/${runId}`, {
      method: 'POST',
    }),

  // Approval
  approve: (runId: string, versionId: string) =>
    request<import('../types/run').Approval>(
      `/runs/${runId}/versions/${versionId}/approve`,
      { method: 'POST' }
    ),

  // Generation
  generate: (runId: string, versionId: string) =>
    request<import('../types/run').Job>(
      `/mcp/generate/${runId}/${versionId}`,
      { method: 'POST' }
    ),
  getJob: (jobId: string) =>
    request<import('../types/run').Job>(`/mcp/jobs/${jobId}`),

  // Logs
  getLogs: (runId: string) =>
    request<import('../types/run').LogEntry[]>(`/runs/${runId}/logs`),
};
