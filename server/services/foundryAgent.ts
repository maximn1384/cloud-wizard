import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';
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
 * The endpoint URL pattern:
 *   {project-endpoint}/agents/{agentName}/endpoint/protocols/activityprotocol
 *
 * Auth: Bearer token from DefaultAzureCredential scoped to the Foundry endpoint.
 * Streams the response and yields text deltas for real-time UI updates.
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

  // Build the Activity Protocol endpoint URL
  const agentUrl = `${projectEndpoint}/agents/${agentName}/endpoint/protocols/activityprotocol`;

  // Get a Bearer token scoped to the Foundry endpoint
  const credential = getCredential();
  // Try cognitive services scope first, then the endpoint-specific scope
  const scopes = ['https://cognitiveservices.azure.com/.default'];
  const tokenResponse = await credential.getToken(scopes);
  if (!tokenResponse?.token) {
    throw new Error('Failed to acquire access token for Foundry endpoint.');
  }

  console.log(`[foundryAgent] Calling Activity Protocol: ${agentUrl}`);

  // Activity Protocol request — Bot Framework-style activity
  const activity = {
    type: 'message',
    text: userPrompt,
    from: { id: 'cloud-wizard-app' },
  };

  const response = await fetch(agentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenResponse.token}`,
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(
      `[foundryAgent] Activity Protocol error: ${response.status} ${errorBody}`
    );
    throw new Error(
      `Agent API ${response.status}: ${errorBody || response.statusText}`
    );
  }

  // Check if the response is streamed (SSE / chunked) or a single JSON response
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/event-stream') || contentType.includes('ndjson')) {
    // Streaming response — parse SSE or newline-delimited JSON
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from agent');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        // Handle SSE format (data: {...})
        const jsonStr = trimmed.startsWith('data: ')
          ? trimmed.slice(6)
          : trimmed;

        try {
          const event = JSON.parse(jsonStr);
          // Extract text from various possible formats
          const text =
            event.text ??
            event.delta?.text ??
            event.delta?.content ??
            event.choices?.[0]?.delta?.content ??
            '';
          if (text) {
            fullText += text;
            onDelta(text);
          }
        } catch {
          // Not JSON — might be raw text
          if (trimmed && !trimmed.startsWith('event:') && !trimmed.startsWith(':')) {
            fullText += trimmed;
            onDelta(trimmed);
          }
        }
      }
    }

    return { outputText: fullText, threadId: '', runId: '' };
  } else {
    // Single JSON response
    const body = await response.json();
    const text =
      body.text ??
      body.reply ??
      body.activities?.[0]?.text ??
      body.output_text ??
      JSON.stringify(body, null, 2);

    onDelta(text);
    return { outputText: text, threadId: '', runId: '' };
  }
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
