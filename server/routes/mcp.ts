import { Router } from 'express';
import {
  DataverseClient,
  isValidOrgUrl,
} from '../services/dataverseClient';
import { runStorage } from '../services/runStorage';
import { v4 as uuidv4 } from 'uuid';

export const mcpRouter = Router();

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(req: { headers: { authorization?: string } }): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// Test connection to a Dynamics 365 environment
mcpRouter.post('/test-connection', async (req, res) => {
  const { runId, url } = req.body as { runId?: string; url?: string };
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ valid: false, error: 'Authentication required' });
    return;
  }

  if (!url || typeof url !== 'string') {
    res.status(400).json({ valid: false, error: 'Environment URL is required' });
    return;
  }

  if (!isValidOrgUrl(url)) {
    res.status(400).json({
      valid: false,
      error:
        'Invalid Dynamics 365 URL. Must be https://<org>.crm.dynamics.com',
    });
    return;
  }

  const client = new DataverseClient(url, token);
  const result = await client.testConnection();

  // Update run environment if connection is valid and runId was provided
  if (result.valid && runId) {
    const run = runStorage.get(runId);
    if (run) {
      run.environment = {
        url,
        validated: true,
        validatedAt: new Date().toISOString(),
      };
      run.status = 'connected';
      run.updatedAt = new Date().toISOString();
      runStorage.save(run);

      runStorage.addLog(runId, {
        id: uuidv4(),
        runId,
        timestamp: new Date().toISOString(),
        level: 'info',
        category: 'system',
        message: `Environment connection validated: ${url}`,
        details: { tableCount: result.tables?.length ?? 0 },
      });
    }
  }

  res.json(result);
});

// Describe a table in the target environment
mcpRouter.post('/describe-table', async (req, res) => {
  const { runId, tableName } = req.body as {
    runId?: string;
    tableName?: string;
  };

  if (!tableName) {
    res.status(400).json({ error: 'tableName is required' });
    return;
  }

  const run = runId ? runStorage.get(runId) : null;
  const envUrl = run?.environment.url;

  if (!envUrl || !run?.environment.validated) {
    res.status(400).json({ error: 'No validated environment connection' });
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const client = new DataverseClient(envUrl, token);
  try {
    const columns = await client.describeTable(tableName);
    res.json({ tableName, columns });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Phase 7 will implement artifact generation via MCP
mcpRouter.post('/generate/:runId/:versionId', (_req, res) => {
  res.status(501).json({ error: 'MCP generation not yet implemented (Phase 7)' });
});

mcpRouter.get('/jobs/:jobId', (_req, res) => {
  res.status(501).json({ error: 'Job tracking not yet implemented (Phase 7)' });
});
