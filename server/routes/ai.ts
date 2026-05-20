import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runStorage } from '../services/runStorage';
import { runAnalystAgent, runFoundryAgent, runFoundryAgentStream, runAgentWithTools } from '../services/foundryAgent';
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
      solutionDesign: null,
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

/**
 * Run the Solution-Architect agent to produce a D365 solution design.
 * Takes the latest requirements draft + user design guidance and returns a design spec.
 * Each call creates a new RunVersion with the agent's solution design.
 */
aiRouter.post('/design/:runId', async (req, res) => {
  const { runId } = req.params;
  const { guidance } = (req.body ?? {}) as { guidance?: string };

  const run = runStorage.get(runId);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  const currentVersion = run.versions.find((v) => v.id === run.currentVersionId);
  if (!currentVersion || !currentVersion.requirementsDraft) {
    res.status(400).json({
      error: 'No requirements draft found. Please run Analysis (Phase 4) first.',
    });
    return;
  }

  runStorage.addLog(runId, {
    id: uuidv4(),
    runId,
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'ai',
    message: 'Starting Solution-Architect design',
    details: { requirementsDraftId: currentVersion.requirementsDraft },
  });

  try {
    const agentName =
      process.env.AZURE_AI_SOLUTION_ARCHITECT_AGENT_ID ?? 'Solution-Architect';

    const designPrompt = [
      'You are receiving a requirements specification drafted by the Migration-Analyst.',
      'Your task: transform these requirements into a concrete Dynamics 365 Cloud solution design.',
      '',
      'Your design must include:',
      '1. Mapped Dataverse entities (native Account, Contact, Case, etc. OR custom)',
      '2. Field definitions with types and requirements',
      '3. Relationships and hierarchies',
      '4. MCP-ready deployment steps (hints for Phase 7 generation)',
      '5. Data transformation rules',
      '',
      'Follow your system instructions for design format and detail level.',
      '',
      guidance ? `User design guidance:\n${guidance}\n` : '',
      '--- REQUIREMENTS DRAFT ---',
      '```markdown',
      currentVersion.requirementsDraft.markdown,
      '```',
    ].join('\n');

    const result = await runFoundryAgent(agentName, designPrompt);

    const versionNumber = run.versions.length + 1;
    const newVersion: RunVersion = {
      id: uuidv4(),
      runId,
      versionNumber,
      createdAt: new Date().toISOString(),
      analysis: null,
      requirementsDraft: currentVersion.requirementsDraft,
      solutionDesign: {
        markdown: result.outputText,
        agentName,
        conversationId: result.conversationId,
        responseId: result.responseId,
        generatedAt: new Date().toISOString(),
        userGuidance: guidance,
      },
      userEdits: [],
      approval: null,
      generationJob: null,
    };

    run.versions.push(newVersion);
    run.currentVersionId = newVersion.id;
    run.updatedAt = new Date().toISOString();
    runStorage.save(run);

    runStorage.addLog(runId, {
      id: uuidv4(),
      runId,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'ai',
      message: `Solution design v${versionNumber} completed (${result.outputText.length} chars)`,
      details: { versionId: newVersion.id, conversationId: result.conversationId },
    });

    res.json(newVersion);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    run.updatedAt = new Date().toISOString();
    runStorage.save(run);

    runStorage.addLog(runId, {
      id: uuidv4(),
      runId,
      timestamp: new Date().toISOString(),
      level: 'error',
      category: 'ai',
      message: 'Solution design failed',
      details: { error: message },
    });

    res.status(500).json({ error: message });
  }
});

/**
 * Run the Solution-Builder agent to execute the approved design in D365.
 * Streams the agent's output via Server-Sent Events (SSE) so the frontend
 * can show real-time deployment progress.
 */
aiRouter.post('/generate/:runId', async (req, res) => {
  const { runId } = req.params;

  const run = runStorage.get(runId);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  const currentVersion = run.versions.find((v) => v.id === run.currentVersionId);
  if (!currentVersion) {
    res.status(400).json({ error: 'No current version found.' });
    return;
  }

  if (!currentVersion.approval) {
    res.status(400).json({
      error: 'Version must be approved before generation. Please approve first.',
    });
    return;
  }

  if (!currentVersion.solutionDesign) {
    res.status(400).json({
      error: 'No solution design found. Please run Solution Design (Phase 5) first.',
    });
    return;
  }

  const environmentUrl = run.environment.url;
  if (!environmentUrl) {
    res.status(400).json({
      error: 'No environment URL configured. Please connect to a D365 environment first.',
    });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  runStorage.addLog(runId, {
    id: uuidv4(),
    runId,
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'ai',
    message: 'Starting Solution-Builder generation (streaming)',
    details: {
      versionId: currentVersion.id,
      environmentUrl,
      designAgent: currentVersion.solutionDesign.agentName,
    },
  });

  run.status = 'generating';
  run.updatedAt = new Date().toISOString();
  runStorage.save(run);

  try {
    const agentName =
      process.env.AZURE_AI_BUILDER_AGENT_ID ?? 'Solution-Builder';

    const generatePrompt = [
      'You are receiving an approved solution design for a Dynamics 365 migration.',
      'Execute this design in the target Dataverse environment using your MCP tools.',
      '',
      `**Target Environment:** ${environmentUrl}`,
      '',
      'Follow your system instructions:',
      '1. Inspect the environment first (list_tables, describe_table)',
      '2. Deploy schema changes (create/update tables and columns)',
      '3. Create relationships',
      '4. Migrate data if specified',
      '5. Verify all changes',
      '',
      'Produce a complete deployment report.',
      '',
      '--- APPROVED SOLUTION DESIGN ---',
      '```markdown',
      currentVersion.solutionDesign.markdown,
      '```',
    ].join('\n');

    const result = await runAgentWithTools(
      agentName,
      generatePrompt,
      (delta) => {
        // Send each text chunk as an SSE event
        res.write(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`);
      }
    );

    // Store the generation result on the current version
    (currentVersion as any).generationResult = {
      markdown: result.outputText,
      agentName,
      conversationId: result.threadId,
      responseId: result.runId,
      generatedAt: new Date().toISOString(),
      environmentUrl,
    };

    run.status = 'completed';
    run.updatedAt = new Date().toISOString();
    runStorage.save(run);

    runStorage.addLog(runId, {
      id: uuidv4(),
      runId,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'ai',
      message: `Generation completed (${result.outputText.length} chars)`,
      details: {
        versionId: currentVersion.id,
        conversationId: result.conversationId,
      },
    });

    // Send completion event with full version data
    res.write(`data: ${JSON.stringify({ type: 'done', version: currentVersion })}\n\n`);
    res.end();
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
      message: 'Generation failed',
      details: { error: message },
    });

    // Send error as SSE event and close
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
    res.end();
  }
});

/**
 * DEBUG / TEST ENDPOINT: Call the Builder agent directly with a design + environment URL.
 * No run, no approval, no version needed. Streams SSE.
 *
 * Usage:
 *   curl -N -X POST http://localhost:3001/api/ai/generate-test \
 *     -H "Content-Type: application/json" \
 *     -d '{"environmentUrl":"https://org41476d09.crm.dynamics.com","design":"..."}'
 */
aiRouter.post('/generate-test', async (req, res) => {
  const { environmentUrl, design } = req.body as {
    environmentUrl: string;
    design: string;
  };

  if (!environmentUrl || !design) {
    res.status(400).json({
      error: 'Required: { environmentUrl: string, design: string }',
    });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const agentName =
    process.env.AZURE_AI_BUILDER_AGENT_ID ?? 'Solution-Builder';

  const generatePrompt = [
    'You are receiving an approved solution design for a Dynamics 365 migration.',
    'Execute this design in the target Dataverse environment using your MCP tools.',
    '',
    `**Target Environment:** ${environmentUrl}`,
    '',
    'Follow your system instructions:',
    '1. Inspect the environment first (list_tables, describe_table)',
    '2. Deploy schema changes (create/update tables and columns)',
    '3. Create relationships',
    '4. Migrate data if specified',
    '5. Verify all changes',
    '',
    'Produce a complete deployment report.',
    '',
    '--- APPROVED SOLUTION DESIGN ---',
    '```markdown',
    design,
    '```',
  ].join('\n');

  console.log(`[generate-test] Calling ${agentName} for ${environmentUrl}`);

  try {
    const result = await runAgentWithTools(agentName, generatePrompt, (delta) => {
      res.write(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`);
    });

    console.log(
      `[generate-test] Done (${result.outputText.length} chars, threadId=${result.threadId})`
    );
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generate-test] Error: ${message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
    res.end();
  }
});
