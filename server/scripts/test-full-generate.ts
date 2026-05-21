/**
 * Full end-to-end test: Agent produces plan → App executes via Dataverse MCP
 * Run: npx tsx server/scripts/test-full-generate.ts
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { DefaultAzureCredential } from '@azure/identity';
import { AIProjectClient } from '@azure/ai-projects';
import { DataverseMcpClient } from '../services/dataverseMcp';

const ENV_URL = 'https://org41476d09.crm.dynamics.com';
const DESIGN_FILE = 'server/scripts/test-design.md';

async function main() {
  const design = readFileSync(DESIGN_FILE, 'utf-8');
  console.log(`[test] Design loaded (${design.length} chars)`);
  console.log(`[test] Environment: ${ENV_URL}`);

  // Step 1: Get execution plan from agent
  console.log('\n=== STEP 1: Getting execution plan from Solution-Builder ===\n');

  const project = new AIProjectClient(
    process.env.AZURE_AI_PROJECT_ENDPOINT!,
    new DefaultAzureCredential()
  );
  const openai = project.getOpenAIClient({ agentName: 'Solution-Builder' });

  const planPrompt = [
    'Produce a JSON execution plan for this design.',
    '',
    `Target Environment: ${ENV_URL}`,
    '',
    '--- APPROVED SOLUTION DESIGN ---',
    design.substring(0, 8000),
  ].join('\n');

  const planResp = await openai.responses.create({
    input: planPrompt,
    model: 'gpt-5.4-pro',
    agent_reference: { name: 'Solution-Builder', type: 'agent_reference' },
  } as any);

  let jsonStr = (planResp.output_text ?? '').trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  const plan = JSON.parse(jsonStr);
  console.log(`[test] Plan: ${plan.summary}`);
  console.log(`[test] Steps: ${plan.plan.length}`);

  // Step 2: Execute each step via Dataverse MCP
  console.log('\n=== STEP 2: Executing plan via Dataverse MCP ===\n');

  const cred = new DefaultAzureCredential();
  const token = await cred.getToken(`${ENV_URL}/.default`);
  const mcp = new DataverseMcpClient(ENV_URL, token.token);

  for (const step of plan.plan) {
    console.log(`Step ${step.step}: ${step.action} — ${step.description}`);

    const result = await mcp.call(step.mcpCall.method, step.mcpCall.params);

    if (result.success) {
      const summary = typeof result.data === 'string'
        ? result.data.substring(0, 200)
        : JSON.stringify(result.data).substring(0, 200);
      console.log(`  ✅ Success: ${summary}`);
    } else {
      console.log(`  ⚠️ Error: ${result.error}`);
    }
    console.log('');
  }

  console.log('=== DONE ===');
}

main().catch((e) => {
  console.error('[test] Fatal error:', e.message);
  process.exit(1);
});
