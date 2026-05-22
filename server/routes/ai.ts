import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runStorage } from '../services/runStorage';
import { runAnalystAgent, runFoundryAgent, runFoundryAgentStream, runAgentWithTools } from '../services/foundryAgent';
import { DataverseMcpClient } from '../services/dataverseMcp';
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

    // Parse backlog from the agent's response (wrapped in ```deployment-backlog fence)
    let markdown = result.outputText;
    let backlog: import('../../src/types/run').BacklogItem[] = [];
    const backlogMatch = markdown.match(/```deployment-backlog\s*([\s\S]*?)```/);
    if (backlogMatch) {
      try {
        backlog = JSON.parse(backlogMatch[1].trim()).map((item: any) => ({
          ...item,
          status: 'pending',
          userApproved: false,
        }));
        // Remove the backlog fence from the markdown
        markdown = markdown.replace(/```deployment-backlog[\s\S]*?```/, '').trim();
      } catch (e) {
        console.error('[design] Failed to parse deployment backlog:', e);
      }
    }
    console.log(`[design] Backlog items: ${backlog.length}`);

    const versionNumber = run.versions.length + 1;
    const newVersion: RunVersion = {
      id: uuidv4(),
      runId,
      versionNumber,
      createdAt: new Date().toISOString(),
      analysis: null,
      requirementsDraft: currentVersion.requirementsDraft,
      solutionDesign: {
        markdown,
        backlog,
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
 * Run the Solution-Builder agent to produce a plan, then execute it via Dataverse MCP.
 * Flow: Agent produces JSON plan → App executes each step via MCP → streams progress via SSE.
 */
aiRouter.post('/generate/:runId', async (req, res) => {
  const { runId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';

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

  const sendDelta = (text: string) => {
    res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
  };

  run.status = 'generating';
  run.updatedAt = new Date().toISOString();
  runStorage.save(run);

  try {
    const agentName =
      process.env.AZURE_AI_BUILDER_AGENT_ID ?? 'Solution-Builder';

    // Step 1: Get execution plan from agent
    sendDelta('## Phase 1: Planning\n\nAsking Solution-Builder to create an execution plan...\n\n');

    const planPrompt = [
      'Produce a JSON execution plan for the following approved solution design.',
      '',
      `Target Environment: ${environmentUrl}`,
      '',
      '--- APPROVED SOLUTION DESIGN ---',
      currentVersion.solutionDesign.markdown,
    ].join('\n');

    const planResult = await runFoundryAgent(agentName, planPrompt);

    // Parse the JSON plan from the agent's response
    let plan: { plan: Array<{ step: number; action: string; description: string; mcpCall: { method: string; params: Record<string, unknown> }; dependsOn?: number }>; summary: string };
    try {
      // Extract JSON from the response (agent might wrap it in markdown fences)
      let jsonStr = planResult.outputText.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      plan = JSON.parse(jsonStr);
    } catch {
      sendDelta(`**Error:** Could not parse execution plan from agent.\n\nRaw response:\n${planResult.outputText.substring(0, 1000)}\n`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to parse execution plan' })}\n\n`);
      res.end();
      return;
    }

    sendDelta(`**Plan received:** ${plan.summary}\n\n`);
    sendDelta(`| Step | Action | Description | Status |\n|------|--------|-------------|--------|\n`);

    // Step 2: Execute each step via Dataverse MCP
    const mcpClient = new DataverseMcpClient(environmentUrl, token);
    const results: Array<{ step: number; action: string; success: boolean; details: string }> = [];

    for (const step of plan.plan) {
      sendDelta(`| ${step.step} | ${step.action} | ${step.description} | ⏳ Running... |\n`);

      const mcpResult = await mcpClient.call(
        step.mcpCall.method,
        step.mcpCall.params
      );

      if (mcpResult.success) {
        const summary = typeof mcpResult.data === 'string'
          ? mcpResult.data.substring(0, 100)
          : JSON.stringify(mcpResult.data).substring(0, 100);
        results.push({ step: step.step, action: step.action, success: true, details: summary });
        sendDelta(`\n> ✅ Step ${step.step}: ${step.description} — Success\n\n`);
      } else {
        results.push({ step: step.step, action: step.action, success: false, details: mcpResult.error ?? 'Unknown error' });
        sendDelta(`\n> ⚠️ Step ${step.step}: ${step.description} — ${mcpResult.error}\n\n`);
      }
    }

    // Step 3: Summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const summaryText = `\n## Deployment Complete\n\n- **Steps executed:** ${results.length}\n- **Succeeded:** ${succeeded}\n- **Failed:** ${failed}\n- **Environment:** ${environmentUrl}\n`;
    sendDelta(summaryText);

    // Store result
    const fullReport = plan.plan.map((s, i) => {
      const r = results[i];
      return `${r?.success ? '✅' : '⚠️'} Step ${s.step}: ${s.description} — ${r?.success ? 'OK' : r?.details}`;
    }).join('\n');

    (currentVersion as any).generationResult = {
      markdown: `${plan.summary}\n\n${fullReport}\n\n${summaryText}`,
      agentName,
      conversationId: planResult.conversationId,
      responseId: planResult.responseId,
      generatedAt: new Date().toISOString(),
      environmentUrl,
    };

    run.status = 'completed';
    run.updatedAt = new Date().toISOString();
    runStorage.save(run);

    res.write(`data: ${JSON.stringify({ type: 'done', version: currentVersion })}\n\n`);
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run.status = 'error';
    run.updatedAt = new Date().toISOString();
    runStorage.save(run);
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

/**
 * Deploy selected backlog items incrementally.
 * For each MCP item: asks Solution-Builder for plan refinement → executes via MCP.
 * For manual items: returns instructions without executing.
 * Streams progress via SSE.
 */
aiRouter.post('/deploy-items/:runId', async (req, res) => {
  const { runId } = req.params;
  const { itemIds, userNotes } = req.body as {
    itemIds: string[];
    userNotes?: Record<string, string>;
  };
  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';

  const run = runStorage.get(runId);
  if (!run) { res.status(404).json({ error: 'Run not found' }); return; }

  const currentVersion = run.versions.find((v) => v.id === run.currentVersionId);
  if (!currentVersion?.solutionDesign) {
    res.status(400).json({ error: 'No solution design found.' });
    return;
  }

  const backlog = currentVersion.solutionDesign.backlog ?? [];
  const selectedItems = backlog.filter((item) => itemIds.includes(item.id));

  if (selectedItems.length === 0) {
    res.status(400).json({ error: 'No matching backlog items found.' });
    return;
  }

  const environmentUrl = run.environment.url;
  if (!environmentUrl) {
    res.status(400).json({ error: 'No environment URL configured.' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Sort by priority, respect dependencies
  const sorted = selectedItems.sort((a, b) => a.priority - b.priority);
  const mcpClient = new DataverseMcpClient(environmentUrl, token);

  for (const item of sorted) {
    // Apply user notes if provided
    if (userNotes?.[item.id]) {
      item.userNotes = userNotes[item.id];
    }

    // Check dependencies
    const unmetDeps = item.dependencies.filter((depId) => {
      const dep = backlog.find((b) => b.id === depId);
      return dep && dep.status !== 'completed';
    });
    if (unmetDeps.length > 0) {
      item.status = 'pending';
      sendEvent({ type: 'item-status', itemId: item.id, status: 'pending', message: `Waiting for: ${unmetDeps.join(', ')}` });
      continue;
    }

    if (item.deploymentMethod === 'manual') {
      item.status = 'skipped';
      sendEvent({
        type: 'item-status',
        itemId: item.id,
        status: 'skipped',
        message: item.manualInstructions ?? 'Manual configuration required.',
      });
      continue;
    }

    // MCP execution
    item.status = 'in-progress';
    sendEvent({ type: 'item-status', itemId: item.id, status: 'in-progress', message: `Deploying: ${item.name}` });

    const mcpCalls = item.mcpCalls ?? [];
    if (mcpCalls.length === 0) {
      // Ask Solution-Builder for execution plan for this item
      try {
        const agentName = process.env.AZURE_AI_BUILDER_AGENT_ID ?? 'Solution-Builder';
        const itemPrompt = [
          `Produce a JSON execution plan for this single backlog item:`,
          `Item: ${item.name}`,
          `Description: ${item.description}`,
          `Category: ${item.category}`,
          item.userNotes ? `User notes: ${item.userNotes}` : '',
          `Target Environment: ${environmentUrl}`,
        ].join('\n');
        const planResult = await runFoundryAgent(agentName, itemPrompt);
        let jsonStr = planResult.outputText.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        const plan = JSON.parse(jsonStr);
        for (const step of plan.plan ?? []) {
          mcpCalls.push(step.mcpCall);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        item.status = 'failed';
        item.result = { completedAt: new Date().toISOString(), success: false, details: '', error: `Plan generation failed: ${msg}` };
        sendEvent({ type: 'item-status', itemId: item.id, status: 'failed', message: item.result.error });
        continue;
      }
    }

    // Execute MCP calls
    let allSuccess = true;
    const details: string[] = [];

    for (const call of mcpCalls) {
      const mcpResult = await mcpClient.call(call.method, call.params);
      const resultText = mcpResult.success
        ? (typeof mcpResult.data === 'string' ? mcpResult.data : JSON.stringify(mcpResult.data)).substring(0, 200)
        : mcpResult.error ?? 'Unknown error';

      if (mcpResult.success) {
        details.push(`✅ ${call.params?.name ?? call.method}: ${resultText}`);
        sendEvent({ type: 'item-progress', itemId: item.id, message: `✅ ${call.params?.name ?? call.method}` });
      } else {
        allSuccess = false;
        details.push(`⚠️ ${call.params?.name ?? call.method}: ${resultText}`);
        sendEvent({ type: 'item-progress', itemId: item.id, message: `⚠️ ${call.params?.name ?? call.method}: ${resultText}` });
      }
    }

    item.status = allSuccess ? 'completed' : 'failed';
    item.result = {
      completedAt: new Date().toISOString(),
      success: allSuccess,
      details: details.join('\n'),
      error: allSuccess ? undefined : details.filter((d) => d.startsWith('⚠️')).join('\n'),
    };

    sendEvent({ type: 'item-status', itemId: item.id, status: item.status, message: allSuccess ? 'Completed' : 'Completed with errors' });
  }

  // Save updated backlog
  run.updatedAt = new Date().toISOString();
  runStorage.save(run);

  sendEvent({ type: 'done', backlog });
  res.end();
});
