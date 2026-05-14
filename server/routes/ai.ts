import { Router } from 'express';

export const aiRouter = Router();

// Phase 4 will implement Azure Foundry AI integration
aiRouter.post('/analyze/:runId', (_req, res) => {
  res.status(501).json({ error: 'AI analysis not yet implemented (Phase 4)' });
});
