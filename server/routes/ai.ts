import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runStorage } from '../services/runStorage';
import { runAnalystAgent } from '../services/foundryAgent';
import type { RunVersion } from '../../src/types/run';

export const aiRouter = Router();

/**
 * Run the Migration-Analyst agent on the current run's source files.
 * Each call creates a new RunVersion with the agent's requirements draft.
 */
aiRouter.post('/analyze/:runId', async (req, res) => {
  const { runId } = req.params;
  const { feedback } = (req.body ?? {}) as { feedback?: string };

  const run = runStorage.get(runId);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  if (run.sourceFiles.length === 0) {
    res.status(400).json({ error: 'No source files uploaded for this run' });
    return;
  }

  runStorage.addLog(runId, {
    id: uuidv4(),
    runId,
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'ai',
    message: 'Starting analysis with Migration-Analyst agent',
    details: { fileCount: run.sourceFiles.length, hasFeedback: !!feedback },
  });

  run.status = 'analyzing';
  run.updatedAt = new Date().toISOString();
  runStorage.save(run);

  try {
    const result = await runAnalystAgent(run.sourceFiles, feedback);

    const versionNumber = run.versions.length + 1;
    const version: RunVersion = {
      id: uuidv4(),
      runId,
      versionNumber,
      createdAt: new Date().toISOString(),
      analysis: null,
      requirementsDraft: {
        markdown: result.outputText,
        agentName: process.env.AZURE_AI_AGENT_ID ?? 'Migration-Analyst',
        conversationId: result.conversationId,
        responseId: result.responseId,
        generatedAt: new Date().toISOString(),
        userFeedback: feedback,
      },
      userEdits: [],
      approval: null,
      generationJob: null,
    };

    run.versions.push(version);
    run.currentVersionId = version.id;
    run.status = 'analyzed';
    run.updatedAt = new Date().toISOString();
    runStorage.save(run);

    runStorage.addLog(runId, {
      id: uuidv4(),
      runId,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'ai',
      message: `Analysis v${versionNumber} completed (${result.outputText.length} chars)`,
      details: { versionId: version.id, conversationId: result.conversationId },
    });

    res.json(version);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    run.status = 'error';
    run.updatedAt = new Date().toISOString();
    runStorage.save(run);

    runStorage.addLog(runId, {
      id: uuidv4(),
      runId,
      timestamp: new Date().toISOString(),
      level: 'error',
      category: 'ai',
      message: 'Analysis failed',
      details: { error: message },
    });

    res.status(500).json({ error: message });
  }
});
