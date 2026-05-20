/**
 * Quick test script for the Solution-Builder agent.
 *
 * Usage:
 *   npx tsx server/scripts/test-builder.ts
 *
 * Reads design from server/scripts/test-design.md (create this file with your design).
 * Calls the Builder agent and prints streaming output to the console.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { runAgentWithTools } from '../services/foundryAgent';

const ENV_URL =
  process.argv[2] ?? 'https://org41476d09.crm.dynamics.com';

const DESIGN_FILE = 'server/scripts/test-design.md';

async function main() {
  let design: string;

  if (existsSync(DESIGN_FILE)) {
    design = readFileSync(DESIGN_FILE, 'utf-8');
    console.log(`[test] Loaded design from ${DESIGN_FILE} (${design.length} chars)`);
  } else {
    // Minimal test design
    design = `
# Test Design

## Entities
### Account (native)
- Add column: cr_test_field (SingleLine.Text, optional)

## Verification
- Describe account table after update
`;
    console.log('[test] Using minimal built-in test design');
    console.log(`[test] (Create ${DESIGN_FILE} with your real design for full testing)`);
  }

  console.log(`[test] Environment: ${ENV_URL}`);
  console.log(`[test] Agent: ${process.env.AZURE_AI_BUILDER_AGENT_ID ?? 'Solution-Builder'}`);
  console.log('[test] ------- STREAMING OUTPUT -------\n');

  const prompt = [
    'Execute this design in the target Dataverse environment using your MCP tools.',
    '',
    `**Target Environment:** ${ENV_URL}`,
    '',
    '--- APPROVED SOLUTION DESIGN ---',
    '```markdown',
    design,
    '```',
  ].join('\n');

  try {
    const result = await runAgentWithTools(
      process.env.AZURE_AI_BUILDER_AGENT_ID ?? 'Solution-Builder',
      prompt,
      (delta) => process.stdout.write(delta)
    );

    console.log('\n\n[test] ------- DONE -------');
    console.log(`[test] threadId: ${result.threadId}`);
    console.log(`[test] runId: ${result.runId}`);
    console.log(`[test] Total chars: ${result.outputText.length}`);
  } catch (err) {
    console.error('\n[test] ERROR:', err);
    process.exit(1);
  }
}

main();
