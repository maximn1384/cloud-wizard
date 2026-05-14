import { create } from 'zustand';
import type { Run, RunVersion, EnvironmentConfig, SourceFile } from '../types/run';
import { v4 as uuidv4 } from 'uuid';

interface RunStore {
  runs: Run[];
  activeRunId: string | null;

  // Selectors
  activeRun: () => Run | null;
  activeVersion: () => RunVersion | null;

  // Run CRUD
  createRun: (name: string) => Run;
  setActiveRun: (id: string | null) => void;
  updateRunStatus: (id: string, status: Run['status']) => void;

  // Environment
  setEnvironment: (runId: string, env: EnvironmentConfig) => void;

  // Source files
  addSourceFiles: (runId: string, files: SourceFile[]) => void;
  removeSourceFile: (runId: string, fileId: string) => void;

  // Versions
  addVersion: (runId: string, version: RunVersion) => void;
  setCurrentVersion: (runId: string, versionId: string) => void;

  // Hydrate from API
  setRuns: (runs: Run[]) => void;
  setRun: (run: Run) => void;
}

export const useRunStore = create<RunStore>((set, get) => ({
  runs: [],
  activeRunId: null,

  activeRun: () => {
    const { runs, activeRunId } = get();
    return runs.find((r) => r.id === activeRunId) ?? null;
  },

  activeVersion: () => {
    const run = get().activeRun();
    if (!run || !run.currentVersionId) return null;
    return run.versions.find((v) => v.id === run.currentVersionId) ?? null;
  },

  createRun: (name: string) => {
    const run: Run = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      environment: { url: '', validated: false, validatedAt: null },
      sourceFiles: [],
      versions: [],
      currentVersionId: null,
    };
    set((state) => ({ runs: [...state.runs, run], activeRunId: run.id }));
    return run;
  },

  setActiveRun: (id) => set({ activeRunId: id }),

  updateRunStatus: (id, status) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
      ),
    })),

  setEnvironment: (runId, env) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId
          ? { ...r, environment: env, updatedAt: new Date().toISOString() }
          : r
      ),
    })),

  addSourceFiles: (runId, files) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId
          ? {
              ...r,
              sourceFiles: [...r.sourceFiles, ...files],
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
    })),

  removeSourceFile: (runId, fileId) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId
          ? {
              ...r,
              sourceFiles: r.sourceFiles.filter((f) => f.id !== fileId),
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
    })),

  addVersion: (runId, version) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId
          ? {
              ...r,
              versions: [...r.versions, version],
              currentVersionId: version.id,
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
    })),

  setCurrentVersion: (runId, versionId) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId ? { ...r, currentVersionId: versionId } : r
      ),
    })),

  setRuns: (runs) => set({ runs }),
  setRun: (run) =>
    set((state) => ({
      runs: state.runs.map((r) => (r.id === run.id ? run : r)),
    })),
}));
