# Cloud Wizard – Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React SPA – Independent Web App)                     │
│  Fluent UI v9 · React Router · Zustand state · MSAL Auth       │
│  Wizard Steps: Connect → Upload → Analyze → Design → Approve   │
│                → Generate → Logs                                │
└──────────────┬──────────────────────────────────────────────────┘
               │ REST calls (Bearer token for Dataverse endpoints)
┌──────────────▼──────────────────────────────────────────────────┐
│  Backend API (Express / Node.js)                                │
│  • /api/ai/*        → Azure Foundry AI proxy                   │
│  • /api/mcp/*       → MCP server bridge (Dataverse ops, auth)  │
│  • /api/runs/*      → Run management & versioning              │
│  • /api/upload      → Excel upload & parsing                   │
└──────┬────────────────────────┬─────────────────────────────────┘
       │                        │
┌──────▼──────┐   ┌─────────────▼──────────────┐
│ Azure       │   │  Dataverse Web API         │
│ Foundry AI  │   │  (Direct REST calls with   │
│ Model       │   │  user's Bearer token from  │
│ Endpoint    │   │  MSAL authentication)      │
└─────────────┘   └────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript 5.9, Fluent UI v9 |
| Routing | react-router-dom v7 |
| State | Zustand |
| Excel Parsing | xlsx (SheetJS) |
| Backend API | Express + tsx (TypeScript) |
| AI Engine | `@azure/ai-projects` + `@azure/identity` → Azure AI Foundry **Agent** (via OpenAI Responses API) |
| Dataverse Ops | Direct Web API calls (REST) with user's MSAL Bearer token |
| IDs | uuid v11 |
| Dev Tooling | concurrently (frontend + backend) |

---

## Phase 1: Project Foundation & Environment Setup

**Goal:** Establish project structure, routing, state management, and dev tooling.

### Tasks

1.1 **Install all dependencies** (frontend + backend)
- `react-router-dom`, `zustand`, `xlsx`, `uuid`
- Backend: `express`, `cors`, `multer`, `@modelcontextprotocol/sdk`, `openai`
- Dev: `concurrently`, `tsx`, `@types/*`

1.2 **Create folder structure**
```
src/
  components/
    layout/          → Shell, Sidebar, WizardNav
    wizard/          → Step components (one per journey)
    common/          → Reusable UI atoms
  hooks/             → Custom React hooks
  services/
    dataverse.ts     → (existing) org URL + entity map
    api.ts           → Backend API client
  stores/
    runStore.ts      → Zustand store for run state
    uiStore.ts       → Wizard navigation state
  types/
    run.ts           → Run, RunVersion, Approval, Job, LogEntry
    schema.ts        → Source/destination schema types
    mapping.ts       → Mapping types
  utils/
    excel.ts         → Client-side Excel preview helpers
server/
  index.ts           → Express entry point
  routes/
    ai.ts            → Azure Foundry proxy routes
    mcp.ts           → MCP bridge routes
    runs.ts          → Run CRUD routes
    upload.ts        → Excel upload + parse route
  services/
    foundry.ts       → Azure Foundry AI client
    mcpClient.ts     → MCP SDK client wrapper
    runStorage.ts    → In-memory run store (MVP)
  types/
    index.ts         → Shared server types
```

1.3 **Set up React Router** with wizard layout
- Routes: `/`, `/runs`, `/runs/:id/connect`, `/runs/:id/upload`, `/runs/:id/analyze`, `/runs/:id/design`, `/runs/:id/approve`, `/runs/:id/generate`, `/runs/:id/logs`

1.4 **Create app shell** with Fluent UI
- Left sidebar with run list
- Top bar with breadcrumb/stepper
- Main content area for wizard steps

1.5 **Add `dev` script** that runs frontend (Vite) and backend (Express via tsx) concurrently

### Deliverables
- [ ] All dependencies installed
- [ ] Folder structure created
- [ ] Router + shell layout rendering
- [ ] `npm run dev` starts both frontend and backend

---

## Phase 2: Run Management & Environment Connection (Journey A)

**Goal:** Users can create runs, connect to a target D365 environment, and persist run state.

### Tasks

2.1 **Define core types** (`Run`, `RunVersion`, `Approval`, `Job`, `LogEntry`)

2.2 **Build Zustand run store**
- CRUD operations for runs
- Active run selection
- Version management

2.3 **Backend: Run management API**
- `POST /api/runs` – create run
- `GET /api/runs` – list runs
- `GET /api/runs/:id` – get run details
- `PUT /api/runs/:id` – update run (name, env config)
- In-memory storage (MVP); structure supports future DB

2.4 **Environment connection UI** (Journey A)
- Form: run name, environment URL, authentication method
- "Test Connection" button → calls MCP `list_tables` to validate
- Connection status indicator
- No plaintext secret storage – use environment references only

2.5 **Backend: MCP client wrapper**
- Initialize MCP SDK client connected to `my-mcp-server`
- `POST /api/mcp/test-connection` → invokes `list_tables` to verify access
- `POST /api/mcp/describe-table` → wraps `describe_table`

### Deliverables
- [ ] Run create/list/view working end-to-end
- [ ] Environment connection validated via MCP `list_tables`
- [ ] User blocked from proceeding until connection is valid

---

## Phase 3: Wizard Intake – Excel Upload & Parsing (Journey B)

**Goal:** Users upload Excel files; system parses, normalizes, and stores source metadata per run.

### Tasks

3.1 **Excel upload UI**
- Drag-and-drop zone + file picker (Fluent UI)
- Support multiple Excel files per run
- File list with remove capability
- Preview of parsed sheets/columns

3.2 **Backend: Excel parsing endpoint**
- `POST /api/upload/:runId` – accepts multipart Excel files (multer)
- Parse with `xlsx`: extract sheet names, column headers, sample rows, data types
- Detect relationships: look for key columns (ID, FK patterns)
- Return structured `SourceSchema` object

3.3 **Source metadata model**
```ts
interface SourceTable {
  fileName: string;
  sheetName: string;
  columns: SourceColumn[];
  sampleRows: Record<string, unknown>[];
  rowCount: number;
  detectedKeys: string[];       // primary key candidates
  detectedRelationships: ForeignKeyHint[];
}
```

3.4 **Store parsed metadata** as part of run state
- Versioned per run
- Validation: block "Analyze" if no files uploaded

3.5 **Parsed data review UI**
- Table view showing each uploaded sheet
- Column listing with inferred types
- Detected relationships visualization
- Row count and sample data preview

### Deliverables
- [ ] Excel upload and parsing works end-to-end
- [ ] Parsed metadata stored per run
- [ ] User can review parsed data before analysis
- [ ] Validation blocks analysis if no input

---

## Phase 4: AI Analysis Engine (Journey C) ✅

**Goal:** Integrate an Azure AI Foundry **Agent** to produce a first-draft requirements specification from parsed source metadata.

### Implementation Notes (as built)

- The agent (`Migration-Analyst`) lives on Azure AI Foundry — its system prompt, D365 native-table alignment rules, and output structure are owned by the **agent definition** (not embedded in this codebase). See `docs/agents/migration-analyst.md` for a reference copy.
- Backend calls the agent through `@azure/ai-projects` → `getOpenAIClient()` → OpenAI **Responses API**, using the **`agent_reference`** pattern (the legacy `agent` property is rejected by the service).
- Authentication uses `DefaultAzureCredential` from `@azure/identity`. Locally this resolves to `AzureCliCredential` after `az login` (no client secrets stored anywhere).

### Tasks

4.1 **Backend: Azure AI Foundry agent client** (`server/services/foundryAgent.ts`)
- `AIProjectClient(endpoint, new DefaultAzureCredential())`
- `project.getOpenAIClient()` → OpenAI Responses API
- Conversation → response flow:
  ```ts
  const conversation = await openai.conversations.create({
    items: [{ type: 'message', role: 'user', content: userPrompt }],
  });
  const response = await openai.responses.create({
    conversation: conversation.id,
    // Foundry-specific field; not in OpenAI SDK types → cast `as any`
    agent_reference: { name: agentName, type: 'agent_reference' },
  } as any);
  ```
- Returns `{ outputText, conversationId, responseId }`
- Env vars: `AZURE_AI_PROJECT_ENDPOINT`, `AZURE_AI_AGENT_ID`

4.2 **AI analysis endpoint** (`server/routes/ai.ts`)
- `POST /api/ai/analyze/:runId` – triggers analysis
- Optional body: `{ feedback?: string }` for iterative re-analysis
- Builds compact JSON payload (`buildAnalystInput`) from parsed `SourceFile[]` (columns, types, sample rows, detected keys & FK hints)
- Stores the agent's markdown output as a `RequirementsDraft` on a new `RunVersion`

4.3 **Output: requirements draft (markdown)**
```ts
interface RequirementsDraft {
  markdown: string;          // agent's structured output
  agentName: string;         // e.g. 'Migration-Analyst'
  conversationId: string;    // Foundry conversation id (for follow-ups)
  responseId: string;        // Foundry response id
  generatedAt: string;       // ISO timestamp
  userFeedback?: string;     // feedback passed for this iteration
}
```
_Note: the original plan called for a fully-typed `AnalysisResult` (schema/mappings/risks). The current draft is markdown; structured extraction is deferred to Phase 5 (Review & Mapping UI) where the user reviews and we parse/extract sections into editable form._

4.4 **Iterative analysis loop**
- `AnalyzeStep` UI exposes a feedback textarea + **Re-analyze** button
- Each call creates a new `RunVersion` (N+1) with its own `RequirementsDraft`
- Version selector (tabs) lets the user switch between drafts

4.5 **Version diff logic** _(deferred to Phase 5)_
- Markdown drafts aren't well-suited to structured diffing; will be added once Phase 5 introduces a structured schema model.

4.6 **Analysis progress UI** (`src/components/wizard/AnalyzeStep.tsx`)
- **Run Analysis** / **Re-analyze** buttons with spinner
- Rendered with `react-markdown` + `remark-gfm` (tables, lists, code blocks)
- Error banner with the backend's error message (e.g. credential failures, API errors)

### Deliverables
- [x] Foundry agent reachable via `agent_reference` pattern
- [x] Analysis stored as versioned `RequirementsDraft` (markdown)
- [x] Iterative re-analysis with user feedback works
- [x] Markdown rendering of agent output in UI
- [ ] Structured diff between versions (moved to Phase 5)

---

## Phase 5: Solution Design – MCP-Ready Architecture (Journey D) 🔄

**Goal:** Transform requirements into a concrete D365 solution design using the Solution-Architect agent. Design includes MCP-ready entity/field definitions and deployment decisions.

### Implementation Notes (as built)

- Receives `RequirementsDraft` from Phase 4 (what we have) + user design input (how to implement in D365)
- Calls `Solution-Architect` agent on Azure Foundry using same `agent_reference` pattern as Migration-Analyst
- Solution-Architect produces **two outputs**:
  1. **Design document** (markdown) — entity definitions, field specs, relationships, deployment details
  2. **Deployment backlog** (JSON) — ordered list of discrete deployment tasks, each with category, method, and dependencies
- The backlog transforms the design from a document into an actionable, incremental deployment plan
- Each backlog item specifies HOW it will be deployed: MCP (automated), Web API (future), or Manual (user does it)
- Output stored as `SolutionDesign` (markdown + backlog JSON) on `RunVersion`

### Tasks

5.1 **Backend: Solution Design endpoint** (`server/routes/ai.ts`)
- `POST /api/ai/design/:runId` – triggers Solution-Architect agent
- Input: requirements markdown + optional user design guidance ("prefer custom entities," "map to Account," etc.)
- Builds prompt from requirements + source schema + user guidance
- Stores markdown output as `SolutionDesign` on new `RunVersion`
- Env vars: `AZURE_AI_AGENT_ID=Solution-Architect`

5.2 **Solution Design output schema**
```ts
interface SolutionDesign {
  markdown: string;          // D365 design specification
  backlog: BacklogItem[];    // Deployment backlog (ordered tasks)
  agentName: string;         // 'Solution-Architect'
  conversationId: string;    // Foundry conversation id
  responseId: string;        // Foundry response id
  generatedAt: string;       // ISO timestamp
  userGuidance?: string;     // user design preferences from this iteration
}

interface BacklogItem {
  id: string;                          // "BL-001"
  category: BacklogCategory;           // "schema" | "data" | "forms" | etc.
  name: string;                        // "Account custom fields"
  description: string;                 // What and why
  deploymentMethod: "mcp" | "webapi" | "manual";
  priority: number;                    // Suggested execution order
  dependencies: string[];              // IDs of items that must complete first
  status: "pending" | "ready" | "in-progress" | "completed" | "failed" | "skipped";

  // Execution details (populated by agent)
  mcpCalls?: McpCall[];                // MCP steps for automated items
  manualInstructions?: string;         // Instructions for manual items

  // User input (editable per item before execution)
  userNotes?: string;                  // Free text guidance, overrides
  userApproved: boolean;               // Explicitly approved for execution

  // Results (populated after execution)
  result?: {
    completedAt: string;
    success: boolean;
    details: string;
    error?: string;
  };
}

type BacklogCategory =
  | "solution"        // Solution container
  | "schema"          // Tables, columns, relationships
  | "data"            // Record migration
  | "forms"           // Forms and views
  | "business-rules"  // Business rules, workflows
  | "security"        // Roles, permissions, teams
  | "sla"             // SLAs, queues, entitlements
  | "navigation"      // Sitemap, app modules
  | "validation"      // Post-deployment verification queries
```

5.3 **Solution Design UI** (`src/components/wizard/SolutionDesignStep.tsx`)
- Display requirements draft (read-only, from Phase 4)
- Show design guidance textarea ("Prefer custom entities," "Map these to Account," etc.)
- **Design** / **Re-design** button (re-runs agent with updated guidance)
- Version tabs for design iterations
- Markdown rendering of Solution-Architect output
- Navigation to Approval with current design locked

5.4 **Iterative design loop**
- User sees requirements → provides design guidance (priorities, constraints)
- Solution-Architect produces a design
- User can iterate with new guidance; each creates new RunVersion
- All versions kept for audit trail

### Deliverables
- [x] Solution-Architect agent callable via `agent_reference`
- [x] Design stored as versioned `SolutionDesign` (markdown)
- [x] User can iterate design with guidance input
- [x] Markdown rendering of agent output in UI
- [x] Clean separation: Requirements (what) vs. Design (how to implement in D365)

---

## Phase 6: Approval Gate (Journey E) ✅

**Goal:** Lightweight approval workflow: review design summary and lock version before generation.

### Implementation Notes (as built)

- No longer a full review UI; that's owned by Phase 5 (Solution Design)
- Shows **summary**: source count, env URL, requirements timestamp, design timestamp, user guidance applied
- Explicit **approve for deployment** button with confirmation (shows target env URL)
- Records who approved (extracted from signed-in account), when, and version
- Backend prevents double-approval (returns 409)
- UI swaps to locked state after approval; enables "Generate" button

### Tasks

6.1 **Approval UI** (`src/components/wizard/ApproveStep.tsx`) ✅
- Summary card: run name, env, source files, agents used (Migration-Analyst → Solution-Architect), timestamps
- Approve button with confirmation dialog (shows target Dataverse URL)
- Locked badge + timestamp after approval
- Navigation: Back to Design → Continue to Generate

6.2 **Backend: Approval endpoint** (`server/routes/runs.ts`) ✅
- `POST /api/runs/:id/versions/:versionId/approve` – records approval
- Body: `{ approvedBy?: string }` (extracted from signed-in user)
- Returns 409 if already approved (idempotent)
- Records `ApprovalMetadata` on version

6.3 **Enforce approval gate**
- Generate button disabled unless current version is approved
- Backend validates approval before Phase 7 execution

### Deliverables
- [x] Lightweight approval gate (summary + confirmation only)
- [x] Version locked after approval
- [x] Approval metadata stored (who, when, version)
- [x] Generation blocked without approval

---

## Phase 7: Incremental Deployment via Backlog (Journey F) ✅

**Goal:** Execute the deployment backlog incrementally — user selects items individually or in bundles, app executes via Dataverse native MCP or flags as manual.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: Solution-Architect produces Design + Deployment Backlog│
│  Backlog = ordered list of discrete tasks with method & deps     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Phase 7: Generate Step — Backlog Checklist UI                   │
│                                                                  │
│  ☑ BL-001 [schema]  Account custom fields     [Deploy] ✅       │
│    💬 "Use mig_ prefix"                                         │
│  ☑ BL-002 [schema]  Contact custom fields     [Deploy] ✅       │
│  ☐ BL-003 [forms]   Case main form            🔧 Manual         │
│    💬 "Put migration fields in separate tab"                     │
│  ☐ BL-004 [data]    Migrate Account records   [Deploy]          │
│                                                                  │
│  [Deploy Selected]  [Deploy All Checked]                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │ MCP items  │   │ WebAPI    │   │ Manual    │
    │ via native │   │ items     │   │ items     │
    │ Dataverse  │   │ (future)  │   │ (tracked) │
    │ /api/mcp   │   │           │   │           │
    └────────────┘   └───────────┘   └───────────┘
```

### Three-Agent Pipeline (as built)

```
Migration-Analyst (what we have) → Solution-Architect (design + backlog) → [approval] → Solution-Builder (execution plans per item)
```

- **Migration-Analyst**: Requirements draft from source data (Responses API)
- **Solution-Architect**: Design document + deployment backlog (Responses API)
- **Solution-Builder**: JSON execution plan per backlog item (Responses API, planner mode)
- **App**: Executes MCP calls against `https://{org}.crm.dynamics.com/api/mcp` using user's MSAL token

### Implementation Notes (as built)

- Dataverse MCP endpoint: `https://org.crm.dynamics.com/api/mcp` (JSON-RPC over HTTPS)
- Auth: User's MSAL Bearer token (app `2725938e-...` + Azure CLI `04b07795-...` in MCP Allowed Clients)
- MCP parameter conventions: `tablename` (not table_name), `item` (stringified JSON array for columns), `querytext` (for queries)
- Solution-Builder agent (v19+) produces JSON execution plans; app executes step-by-step
- Verified: 15 custom columns deployed across account, contact, incident tables via MCP

### Deployment Method Matrix

| Category | Method | Available Now? | Notes |
|----------|--------|:--------------:|-------|
| Schema: tables/columns | MCP | ✅ | `create_table`, `update_table` |
| Schema: relationships | MCP | ✅ | `update_table` with lookup type |
| Data migration | MCP | ✅ | `create_record`, `read_query` |
| Queues | MCP | ✅ | `create_record` on `queue` table |
| Validation queries | MCP | ✅ | `read_query` to verify |
| Forms & Views | Web API | Future | `SystemForm` PATCH (FormXML) |
| Business rules | Manual | — | Configure in maker portal |
| Security roles | Manual | — | Configure in admin center |
| SLA policies | Manual | — | Configure in CS admin |
| Navigation/sitemap | Manual | — | Configure in app designer |
| Solution packaging | Web API | Future | `solutions` POST |

### Tasks

7.1 **Backlog Checklist UI** (`src/components/wizard/GenerateStep.tsx`)
- Display backlog items as an interactive checklist with status badges
- Each item shows: category icon, name, description, deployment method badge (MCP/Manual), status
- Checkbox for selecting items; individual [Deploy] button per item
- [Deploy Selected] button for bundled execution
- Collapsible user notes textarea per item (editable before deployment)
- Real-time progress: streaming MCP output per item as it executes
- Manual items show instructions text instead of Deploy button
- Color coding: green (completed), red (failed), yellow (in-progress), grey (pending)

7.2 **Incremental execution endpoint** (`server/routes/ai.ts`)
- `POST /api/ai/deploy-items/:runId` — executes selected backlog items
- Body: `{ itemIds: string[], userNotes?: Record<string, string> }`
- For each MCP item: asks Solution-Builder for execution plan → executes via MCP → stores result
- For manual items: marks as "skipped" with manual instructions
- Streams progress via SSE
- Respects dependency order (items with unmet dependencies are deferred)

7.3 **Backlog generation in Solution-Architect agent**
- Updated agent instructions to produce `{ design: "...", backlog: [...] }` JSON
- Each backlog item includes category, deployment method, priority, dependencies
- MCP items include pre-built mcpCalls; manual items include instructions

7.4 **Solution-Builder agent (planner mode, v19+)**
- Receives individual backlog item + user notes
- Returns JSON execution plan with correct MCP parameter format
- `item` parameter = stringified JSON array: `'[{"name":"Field","type":"String"}]'`
- `tablename` (no underscore), `querytext` for queries

### Deliverables
- [x] Solution-Builder agent produces JSON execution plans
- [x] App executes MCP calls against Dataverse native endpoint
- [x] 15 custom columns deployed successfully (account, contact, incident)
- [ ] Backlog generation in Solution-Architect agent
- [ ] Backlog checklist UI with individual/bundle execution
- [ ] User notes per backlog item
- [ ] Manual item tracking

---

## Phase 8: Observability & Run History (Journey G + FR-007)

**Goal:** Complete audit trail, execution logs, and test run mode.

### Tasks

8.1 **Log viewer UI**
- Filterable log table: timestamp, action, target, status, details
- Expandable rows for full request/response details
- Filter by: log level, step type, status (success/error)

8.2 **Run history dashboard**
- List all runs with status badges
- Click into run → version timeline
- Per-version: analysis results, edits, approval status, generation status

8.3 **Test Run mode** (Journey G)
- "Test Run" toggle during generation
- Validates mapping and schema assumptions without writing to D365
- Dry-run execution: simulates MCP calls and reports what would happen
- Useful for validation before production migration

8.4 **Export logs**
- Download execution log as JSON/CSV

### Deliverables
- [ ] Full audit trail for every run
- [ ] Log viewer with filtering
- [ ] Test Run (dry-run) mode
- [ ] Log export

---

## Phase 9: Polish, Error Handling & Security Hardening

**Goal:** Production-ready error handling, security, and UX polish.

### Tasks

9.1 **Error handling**
- Retry logic for transient AI and MCP failures (with exponential backoff)
- Graceful degradation for partial failures
- User-friendly error messages with actionable guidance

9.2 **Security**
- No plaintext secrets stored anywhere
- Environment URL validation (must be valid D365 URL)
- Input sanitization on all file uploads
- CORS configuration for Power Apps embedding
- Server-side validation of all inputs

9.3 **UX polish**
- Loading states for all async operations
- Empty states with guidance
- Responsive wizard stepper
- Keyboard navigation
- Toasts/notifications for key actions

9.4 **Multi-model flexibility** (optional)
- Abstract AI client behind interface
- Support swapping Azure Foundry model without code changes

### Deliverables
- [ ] Robust error handling with retries
- [ ] No security vulnerabilities
- [ ] Polished, accessible UI

---

## Dependency Summary

### Frontend (npm)
| Package | Purpose |
|---------|---------|
| react-router-dom | Wizard routing |
| zustand | State management |
| xlsx | Excel file parsing (client-side preview) |
| uuid | Run/version ID generation |

### Backend (npm)
| Package | Purpose |
|---------|---------|
| express | API server |
| cors | Cross-origin requests |
| multer | File upload handling |
| @azure/ai-projects | Azure AI Foundry client (agent calls via Responses API) |
| @azure/identity | `DefaultAzureCredential` (resolves to `az login` locally) |
| dotenv | Load `.env` into backend process |
| uuid | ID generation (shared) |
| xlsx | Excel parsing (server-side) |

### Frontend additions (npm)
| Package | Purpose |
|---------|---------|
| react-markdown + remark-gfm | Render the agent's markdown output (tables, lists, code) |
| @azure/msal-browser | User sign-in & Dataverse Bearer tokens |

### Dev Dependencies
| Package | Purpose |
|---------|---------|
| concurrently | Run frontend + backend |
| tsx | TypeScript execution for backend |
| @types/express | Express type definitions |
| @types/cors | CORS type definitions |
| @types/multer | Multer type definitions |
| @types/uuid | UUID type definitions |

---

## MCP Tools Usage Map

| Journey | MCP Tool | Purpose |
|---------|----------|---------|
| A – Connect | `list_tables` | Validate environment connectivity |
| C – Analyze | `describe_table` | Inspect existing native tables (Account, Contact, etc.) |
| C – Analyze | `list_apps` | Discover existing model-driven apps |
| F – Generate | `create_table` | Create new custom tables if needed |
| F – Generate | `update_table` | Add columns to existing/native tables |
| F – Generate | `describe_table` | Verify schema before/after changes |
| F – Generate | `create_record` | Migrate data rows |
| F – Generate | `read_query` | Validate data after migration |

---

## Milestone Checkpoints

| Milestone | Phases | What's Working |
|-----------|--------|---------------|
| **M1 – Foundation** ✅ | 1-2 | App shell, routing, run creation, env connection (Dataverse WhoAmI) |
| **M2 – Data Intake** ✅ | 3 | Excel upload, parsing, source metadata review |
| **M3 – AI Analysis** ✅ | 4 | Migration-Analyst agent, versioned requirements drafts, iterative feedback |
| **M4 – Solution Design** 🔄 | 5 | Solution-Architect agent, D365 design + deployment backlog, user guidance loop |
| **M5 – Approval Gate** ✅ | 6 | Lightweight approval + confirmation before generation |
| **M5b – Generation** ✅ | 7 | Incremental deployment via backlog, MCP execution verified (15 columns deployed) |
| **M5 – MVP Complete** | 7-8 | End-to-end: upload → analyze → approve → generate in D365 |
| **M6 – Hardened** | 9 | Error handling, security, polish |