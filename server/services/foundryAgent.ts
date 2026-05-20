import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';
import type { SourceFile, SourceTable } from '../../src/types/run';

let cachedClient: AIProjectClient | null = null;

function getProject(): AIProjectClient {
  if (cachedClient) return cachedClient;

  const endpoint = process.env.AZURE_AI_PROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      'AZURE_AI_PROJECT_ENDPOINT not configured. See .env.example.'
    );
  }

  cachedClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
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
 * Run a Foundry agent via the Assistants/Threads API (beta).
 * This API properly activates the agent's configured tools (MCP, code interpreter, etc.)
 * unlike the Responses API + agent_reference which only uses the system prompt.
 *
 * Uses streaming to yield text deltas for real-time UI updates.
 * Falls back to the Responses API streaming if the Assistants API returns 404.
 */
export async function runAgentWithTools(
  agentName: string,
  userPrompt: string,
  onDelta: (text: string) => void
): Promise<{ outputText: string; threadId: string; runId: string }> {
  const project = getProject();
  const openai = project.getOpenAIClient();

  // Try Assistants/Threads API first (activates agent tools)
  try {
    // Use agent name directly as the assistant_id (Foundry convention)
    const stream = openai.beta.threads.createAndRunStream({
      assistant_id: agentName,
      thread: {
        messages: [{ role: 'user', content: userPrompt }],
      },
    });

    let fullText = '';
    let threadId = '';
    let runId = '';

    for await (const event of stream) {
      if (event.event === 'thread.run.created') {
        threadId = event.data.thread_id;
        runId = event.data.id;
      }
      if (event.event === 'thread.message.delta') {
        const delta = event.data.delta;
        if (delta?.content) {
          for (const block of delta.content) {
            if (block.type === 'text' && block.text?.value) {
              fullText += block.text.value;
              onDelta(block.text.value);
            }
          }
        }
      }
    }

    return { outputText: fullText, threadId, runId };
  } catch (err: unknown) {
    const status = (err as any)?.status ?? (err as any)?.code;
    console.log(
      `[foundryAgent] Assistants API failed (status=${status}), falling back to Responses API streaming`
    );

    // Fallback: use Responses API with streaming + agent_reference
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
      threadId: conversation.id,
      runId: responseId,
    };
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
