import type { Run, LogEntry } from './index';

const runs = new Map<string, Run>();
const logs = new Map<string, LogEntry[]>();

export const runStorage = {
  getAll(): Run[] {
    return Array.from(runs.values());
  },

  get(id: string): Run | undefined {
    return runs.get(id);
  },

  save(run: Run): void {
    runs.set(run.id, run);
  },

  delete(id: string): boolean {
    return runs.delete(id);
  },

  // Logs
  addLog(runId: string, entry: LogEntry): void {
    const existing = logs.get(runId) ?? [];
    existing.push(entry);
    logs.set(runId, existing);
  },

  getLogs(runId: string): LogEntry[] {
    return logs.get(runId) ?? [];
  },
};
