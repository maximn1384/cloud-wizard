import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';
import { EventEmitter } from 'events';
import type { SourceFile, SourceTable } from '../../src/types/run';

let cachedClient: AIProjectClient | null = null;
let cachedCredential: DefaultAzureCredential | null = null;

function getCredential(): DefaultAzureCredential {
  if (!cachedCredential) {
    cachedCredential = new DefaultAzureCredential();
  }
  return cachedCredential;
}

function getProject(): AIProjectClient {
  if (cachedClient) return cachedClient;

  const endpoint = process.env.AZURE_AI_PROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      'AZURE_AI_PROJECT_ENDPOINT not configured. See .env.example.'
    );
  }

  cachedClient = new AIProjectClient(endpoint, getCredential());
  return cachedClient;
}

/**
 * Convert parsed source files into a compact JSON payload the analyst agent
 * can consume. We trim sample rows to keep the request reasonable.
 */
export function buildAnalystInput(sourceFiles: SourceFile[]): {
  datasets: Array<{
    fileName: string;
    tableName: string;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
    sampleRows: Record<string, unknown>[];
    rowCount: number;
    detectedKeys: string[];
    detectedRelationships: Array<{
      sourceColumn: string;
      targetTable: string;
      targetColumn: string;
      confidence: number;
    }>;
  }>;
} {
  const datasets = sourceFiles.flatMap((sf) =>
    sf.tables.map((t: SourceTable) => ({
      fileName: sf.fileName,
      tableName: t.sheetName,
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.inferredType,
        nullable: c.nullable,
      })),
      sampleRows: t.sampleRows.slice(0, 3),
      rowCount: t.rowCount,
      detectedKeys: t.detectedKeys,
      detectedRelationships: t.detectedRelationships,
    }))
  );
  return { datasets };
}

/**
 * Call any Azure AI Foundry agent with a custom prompt.
 * Returns the agent's response as text.
 */
export async function runFoundryAgent(
  agentName: string,
  userPrompt: string
): Promise<{ outputText: string; conversationId: string; responseId: string }> {
  const project = getProject();
  const openai = project.getOpenAIClient();

  // Create a conversation, then run the agent against it.
  const conversation = await openai.conversations.create({
    items: [{ type: 'message', role: 'user', content: userPrompt }],
  });

  // Pass agent_reference as an extra body field. The OpenAI SDK types don't
  // know about Foundry's agent_reference, so we cast through `any`.
  const response = await openai.responses.create({
    conversation: conversation.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agent_reference: { name: agentName, type: 'agent_reference' },
  } as any);

  return {
    outputText: response.output_text ?? '',
    conversationId: conversation.id,
    responseId: response.id,
  };
}

/**
 * Call any Azure AI Foundry agent with streaming.
 * Yields text deltas as they arrive so the caller can push them to the client.
 */
export async function runFoundryAgentStream(
  agentName: string,
  userPrompt: string,
  onDelta: (text: string) => void
): Promise<{ outputText: string; conversationId: string; responseId: string }> {
  const project = getProject();
  const openai = project.getOpenAIClient();

  const conversation = await openai.conversations.create({
    items: [{ type: 'message', role: 'user', content: userPrompt }],
  });

  const stream = await openai.responses.create({
    conversation: conversation.id,
    agent_reference: { name: agentName, type: 'agent_reference' },
    stream: true,
  } as any);

  let fullText = '';
  let responseId = '';

  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      const delta = (event as any).delta ?? '';
      fullText += delta;
      onDelta(delta);
    }
    if (event.type === 'response.completed') {
      responseId = (event as any).response?.id ?? '';
    }
  }

  return {
    outputText: fullText,
    conversationId: conversation.id,
    responseId,
  };
}

/**
 * Run a Foundry agent via its native Activity Protocol endpoint.
 * This properly activates the agent's configured tools (MCP, etc.)
 *
 * Flow:
 *   1. Send activity to the agent's Activity Protocol endpoint
 *   2. Agent processes async (calls MCP tools, reasons, etc.)
 *   3. Agent sends reply activities to our callback webhook (serviceUrl)
 *   4. We capture replies and stream text deltas to the caller
 *
 * Requires:
 *   - NGROK_URL env var (public URL pointing to our Express server)
 *   - The agent-callback route mounted at /api/agent-callback
 */
export async function runAgentWithTools(
  agentName: string,
  userPrompt: string,
  onDelta: (text: string) => void
): Promise<{ outputText: string; threadId: string; runId: string }> {
  const projectEndpoint = process.env.AZURE_AI_PROJECT_ENDPOINT;
  if (!projectEndpoint) {
    throw new Error('AZURE_AI_PROJECT_ENDPOINT not configured.');
  }

  const ngrokUrl = process.env.NGROK_URL;
  if (!ngrokUrl) {
    throw new Error(
      'NGROK_URL not configured. Run: ngrok http 3001 and set NGROK_URL in .env'
    );
  }

  const agentUrl = `${projectEndpoint}/agents/${agentName}/endpoint/protocols/activityprotocol?api-version=2025-05-15-preview`;
  const serviceUrl = `${ngrokUrl}/api/agent-callback`;

  // Get Bearer token
  const credential = getCredential();
  const tokenResponse = await credential.getToken('https://ai.azure.com/.default');
  if (!tokenResponse?.token) {
    throw new Error('Failed to acquire access token.');
  }

  const conversationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Register an event emitter to receive replies
  const { pendingReplies } = await import('../routes/agentCallback');
  const emitter = new EventEmitter();
  pendingReplies.set(conversationId, emitter);

  console.log(`[foundryAgent] Activity Protocol: ${agentUrl}`);
  console.log(`[foundryAgent] Callback: ${serviceUrl}`);
  console.log(`[foundryAgent] ConversationId: ${conversationId}`);

  // Send the activity (Bot Framework Activity Protocol format)
  const activity = {
    type: 'message',
    id: `msg-${Date.now()}`,
    timestamp: new Date().toISOString(),
    text: userPrompt,
    channelId: 'directline',
    from: { id: 'cloud-wizard', name: 'Cloud Wizard App' },
    recipient: { id: agentName, name: agentName },
    conversation: { id: conversationId },
    serviceUrl,
  };

  const response = await fetch(agentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenResponse.token}`,
      'foundry-features': 'HostedAgents=V1Preview,AgentEndpoints=V1Preview',
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok && response.status !== 202) {
    const errorBody = await response.text().catch(() => '');
    pendingReplies.delete(conversationId);
    throw new Error(`Agent API ${response.status}: ${errorBody || response.statusText}`);
  }

  console.log(`[foundryAgent] Activity accepted (${response.status}). Waiting for reply...`);

  // Wait for the agent to send replies to our callback
  return new Promise((resolve, reject) => {
    let fullText = '';
    const timeout = setTimeout(() => {
      pendingReplies.delete(conversationId);
      if (fullText) {
        resolve({ outputText: fullText, threadId: conversationId, runId: '' });
      } else {
        reject(new Error('Agent did not reply within 5 minutes.'));
      }
    }, 5 * 60 * 1000);

    emitter.on('text', (text: string) => {
      fullText += text + '\n';
      onDelta(text);
    });

    emitter.on('done', () => {
      clearTimeout(timeout);
      pendingReplies.delete(conversationId);
      resolve({ outputText: fullText, threadId: conversationId, runId: '' });
    });

    emitter.on('error', (err: Error) => {
      clearTimeout(timeout);
      pendingReplies.delete(conversationId);
      reject(err);
    });
  });
}

/**
 * Call the Migration-Analyst agent on Azure AI Foundry.
 * Returns the agent's structured response as markdown text.
 */
export async function runAnalystAgent(
  sourceFiles: SourceFile[],
  userFeedback?: string
): Promise<{ outputText: string; conversationId: string; responseId: string }> {
  const agentName = process.env.AZURE_AI_AGENT_ID ?? 'Migration-Analyst';

  const input = buildAnalystInput(sourceFiles);

  const userPrompt = [
    'You are receiving structured source data extracted from Excel/SQL exports.',
    'Each entry in `datasets` represents one source table with its columns,',
    'inferred types, sample rows, primary key candidates, and detected foreign-key hints.',
    '',
    'Analyze this data and produce a first-draft requirements specification',
    'following the exact format defined in your system instructions',
    '(Overview, Entities, Attributes, Relationships, Business Processes,',
    'Data Issues, Assumptions, Open Questions).',
    '',
    userFeedback
      ? `User feedback for this iteration:\n${userFeedback}\n`
      : '',
    '--- INPUT DATA ---',
    '```json',
    JSON.stringify(input, null, 2),
    '```',
  ].join('\n');

  return runFoundryAgent(agentName, userPrompt);
}
