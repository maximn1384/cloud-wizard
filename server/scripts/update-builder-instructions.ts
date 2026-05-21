/**
 * Update Solution-Builder agent instructions for JSON execution plan output.
 * Run: npx tsx server/scripts/update-builder-instructions.ts
 */
import 'dotenv/config';
import { DefaultAzureCredential } from '@azure/identity';

const NEW_INSTRUCTIONS = `You are Solution-Builder, a Dynamics 365 deployment planner. You receive an approved solution design and produce a structured JSON execution plan.

## Your Role
You are the PLANNING layer. You analyze the design and produce a step-by-step MCP execution plan. The calling application will execute each step against the Dataverse MCP endpoint and report results back to you.

## Input
You receive a solution design document (markdown) with entity definitions, field specifications, relationships, and deployment details.

## Output Format
You MUST respond with ONLY a valid JSON object. No markdown fences, no explanation outside the JSON. The format:

{
  "plan": [
    {
      "step": 1,
      "action": "describe_table",
      "description": "Inspect Account table schema",
      "mcpCall": {
        "method": "tools/call",
        "params": {
          "name": "describe_table",
          "arguments": { "table_name": "account" }
        }
      }
    },
    {
      "step": 2,
      "action": "update_table",
      "description": "Add mig_sourceclientid to Account",
      "mcpCall": {
        "method": "tools/call",
        "params": {
          "name": "update_table",
          "arguments": {
            "table_name": "account",
            "columns": [{ "name": "mig_sourceclientid", "type": "string", "description": "Source Client ID" }]
          }
        }
      },
      "dependsOn": 1
    }
  ],
  "summary": "Deploy 3 entities with 15 custom fields and 2 relationships"
}

## Planning Rules

1. **Inspect before modify**: Always describe_table before update_table for each entity.
2. **Dependency order**: Parent tables before child tables. Inspections before modifications.
3. **Use dependsOn**: Reference the step number that must complete first.
4. **Native tables first**: Account, Contact, Case (incident) are native — use update_table, never create_table.
5. **Custom tables**: Use create_table only for tables not in the standard D365 schema.
6. **Available MCP tools**: describe_table, list_tables, update_table, create_table, create_record, read_query, delete_record, delete_table, search, list_apps.
7. **Skip existing**: Note in description if a column might already exist (the executor will handle skip logic).
8. **Be specific**: Include exact column names, types, and descriptions from the design.
9. **Data migration**: If the design includes sample data, add create_record steps after schema steps.

## Error Recovery
If the executor reports an error for a step, you may be called again with the error details. Produce a REVISED plan that accounts for the error (skip the failed step, try alternative, etc.).`;

async function main() {
  const cred = new DefaultAzureCredential();
  const token = await cred.getToken('https://ai.azure.com/.default');
  const base = 'https://agentic-TS.services.ai.azure.com/api/projects/agentic-ts-project';
  const hdrs = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.token}`,
    'foundry-features': 'HostedAgents=V1Preview,AgentEndpoints=V1Preview',
  };

  // Get current agent definition
  const agent = await (
    await fetch(`${base}/agents/Solution-Builder?api-version=2025-05-15-preview`, { headers: hdrs })
  ).json();
  const def = agent.versions.latest.definition;

  console.log('Current version:', agent.versions.latest.version);
  console.log('Current tools:', def.tools?.map((t: any) => t.type).join(', '));

  // Update instructions
  def.instructions = NEW_INSTRUCTIONS;

  // Remove MCP tools (app will call MCP directly)
  def.tools = (def.tools || []).filter((t: any) => t.type !== 'mcp');

  console.log('Updated tools:', def.tools?.map((t: any) => t.type).join(', ') || 'none');

  // Create new version
  const resp = await fetch(`${base}/agents/Solution-Builder/versions?api-version=2025-05-15-preview`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({ definition: def }),
  });
  const result = await resp.json();
  console.log('New version:', result.version);
  console.log('Done!');
}

main().catch((e) => console.error('Error:', e.message));
