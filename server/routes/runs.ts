import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runStorage } from '../services/runStorage';
import type { Run } from '../types/index';

export const runsRouter = Router();

// List all runs
runsRouter.get('/', (_req, res) => {
  res.json(runStorage.getAll());
});

// Get single run
runsRouter.get('/:id', (req, res) => {
  const run = runStorage.get(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
});

// Create run
runsRouter.post('/', (req, res) => {
  const { name } = req.body as { name?: string };
  const run: Run = {
    id: uuidv4(),
    name: name ?? 'Untitled Run',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    environment: { url: '', validated: false, validatedAt: null },
    sourceFiles: [],
    versions: [],
    currentVersionId: null,
  };
  runStorage.save(run);
  res.status(201).json(run);
});

// Update run
runsRouter.put('/:id', (req, res) => {
  const existing = runStorage.get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  const updated: Run = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };
  runStorage.save(updated);
  res.json(updated);
});

// Get logs for a run
runsRouter.get('/:id/logs', (req, res) => {
  res.json(runStorage.getLogs(req.params.id));
});

// Approve a version
runsRouter.post('/:id/versions/:versionId/approve', (req, res) => {
  const run = runStorage.get(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  const version = run.versions.find((v) => v.id === req.params.versionId);
  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }
  if (version.approval) {
    res.status(409).json({ error: 'Version already approved' });
    return;
  }
  version.approval = {
    versionId: version.id,
    approvedAt: new Date().toISOString(),
    approvedBy: 'Migration Lead',
  };
  run.status = 'approved';
  run.updatedAt = new Date().toISOString();
  runStorage.save(run);
  res.json(version.approval);
});
