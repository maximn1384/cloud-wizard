/**
 * Update Solution-Architect agent to produce design + deployment backlog.
 * Run: npx tsx server/scripts/update-architect-instructions.ts
 */
import 'dotenv/config';
import { DefaultAzureCredential } from '@azure/identity';

const BACKLOG_ADDENDUM = `

## ADDITIONAL OUTPUT: Deployment Backlog

After the design document, you MUST also produce a deployment backlog. The backlog is a JSON array of discrete tasks that the deployment system will execute incrementally.

Output the backlog as a separate section at the END of your response, wrapped in a special fence:

\`\`\`deployment-backlog
[
  {
    "id": "BL-001",
    "category": "schema",
    "name": "Account custom fields",
    "description": "Add mig_sourceclientid, mig_legacyaccountmanagername, mig_industrytext to Account table",
    "deploymentMethod": "mcp",
    "priority": 1,
    "dependencies": [],
    "mcpCalls": [
      {
        "method": "tools/call",
        "params": {
          "name": "describe_table",
          "arguments": { "tablename": "account" }
        }
      },
      {
        "method": "tools/call",
        "params": {
          "name": "update_table",
          "arguments": {
            "tablename": "account",
            "item": "[{\\"name\\":\\"Source Client ID\\",\\"type\\":\\"String\\",\\"required\\":true},{\\"name\\":\\"Legacy Account Manager Name\\",\\"type\\":\\"String\\"},{\\"name\\":\\"Industry Text\\",\\"type\\":\\"String\\"}]"
          }
        }
      }
    ]
  },
  {
    "id": "BL-002",
    "category": "forms",
    "name": "Update Case main form",
    "description": "Add migration fields to the Case main form in a new Migration tab",
    "deploymentMethod": "manual",
    "priority": 10,
    "dependencies": ["BL-003"],
    "manualInstructions": "1. Open the Case main form in the form designer\\n2. Add a new tab called 'Migration'\\n3. Add the following fields: mig_sourcecaseid, mig_sourcecasenumber, mig_sourcecreateddate..."
  }
]
\`\`\`

### Backlog Rules

1. **Categories**: schema, data, forms, business-rules, security, sla, navigation, validation
2. **Deployment methods**:
   - "mcp" = automated via Dataverse MCP (schema changes, data, queries)
   - "webapi" = future automation via Dataverse Web API (forms, views — mark as manual for now)
   - "manual" = user configures manually (business rules, SLAs, security roles, sitemap)
3. **For MCP items**: include mcpCalls array with exact MCP parameters:
   - tablename (one word, no underscore)
   - item = stringified JSON array for columns: '[{"name":"Display Name","type":"String","required":true}]'
   - Valid types: choice, multiselect, customer, multiline text, duration, time zone, language, phone, email, url, lookup, money, string, integer, decimal, boolean, datetime, double, text area, ticker symbol, rich text, file, image
   - For choice fields add "choices": [{"label":"...", "value": 100000000}]
   - For lookup fields add "relatedtable": "target entity logical name"
4. **For manual items**: include manualInstructions with step-by-step text
5. **Dependencies**: reference other item IDs that must complete first
6. **Priority**: lower number = execute first; group by: schema (1-10) → forms (11-20) → data (21-30) → validation (31-40)
7. **Be comprehensive**: include ALL items needed for a complete deployment, even manual ones
8. **Include validation**: add read_query items at the end to verify deployment

### Customer Service / Case Management items to always consider:
- Schema: custom fields on Account, Contact, Case (incident)
- Forms: main forms for Account, Contact, Case with migration fields
- Views: custom views showing migration-specific fields
- Queues: create service queues for case routing
- SLA policies: first response and resolution targets
- Security: migration admin role with customization permissions
- Navigation: ensure CS app shows migration entities
- Validation: count records, verify field values after data load
`;

async function main() {
  const cred = new DefaultAzureCredential();
  const token = await cred.getToken('https://ai.azure.com/.default');
  const base = 'https://agentic-TS.services.ai.azure.com/api/projects/agentic-ts-project';
  const hdrs = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.token}`,
    'foundry-features': 'HostedAgents=V1Preview,AgentEndpoints=V1Preview',
  };

  const agent = await (
    await fetch(`${base}/agents/Solution-Architect?api-version=2025-05-15-preview`, { headers: hdrs })
  ).json();

  const def = agent.versions?.latest?.definition;
  if (!def) {
    console.error('Could not find Solution-Architect agent definition');
    return;
  }

  console.log('Current version:', agent.versions.latest.version);
  console.log('Current instructions length:', def.instructions?.length ?? 0);

  // Append the backlog generation instructions
  def.instructions = (def.instructions ?? '') + BACKLOG_ADDENDUM;

  const resp = await fetch(`${base}/agents/Solution-Architect/versions?api-version=2025-05-15-preview`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({ definition: def }),
  });
  const result = await resp.json();
  console.log('New version:', result.version);
  console.log('Updated instructions length:', def.instructions.length);
  console.log('Done!');
}

main().catch((e) => console.error('Error:', e.message));
