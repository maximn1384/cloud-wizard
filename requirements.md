
 Migration Experience Web App – Requirements (MVP, Spec‑Driven)
1. Purpose
Build a web-based application that enables a guided, AI-assisted workflow to help migrate Dynamics 365 on‑premise applications to Dynamics 365 cloud (Dataverse) by:

collecting requirements and source metadata (Excel first), 
using an AI engine to reason over that input, 
producing Dataverse-aligned schema and mapping recommendations, 
enforcing a human approval gate, 
generating artifacts (solution + schema changes) inside a vanilla Dynamics 365 cloud environment using Dataverse/Dynamics MCP tools. 
The primary goal of this project is to create an alternative migration path for legacy Dynamics 365 applications that is not using a traditional lift and shift approach but rather leveraging AI tools to understand the scope of the legacy application and RECREATE a similar or better app in the Dynamics 365 cloud leveraging MCP tools. IMPORTANT: the destination app must align to the native tables in Dynamics 365: Account, Contact, Case etc. this is very important as the goal is to leverage the native Dynamics 365 Capabilities and most of the migration use cases are ideal fit for Dynamics 365 CRM, such as case management or customer relations.


 2. Critical Constraints (Must Be True)

Target platform MUST be Dynamics 365 cloud (Dataverse). 
Artifact generation MUST happen inside a vanilla Dynamics 365 environment (no assumption of prebuilt custom components). 
The system MUST use Dataverse/Dynamics MCP tools for environment inspection and artifact generation. 
The system MUST use an AI reasoning engine hosted in Azure Foundry (see Section 6). 
Human approval is mandatory before executing changes. 


 3. Scope
In Scope (MVP)

Web UI “wizard” to capture requirements and ingest source metadata 
Source input: Excel spreadsheets (MVP)
AI analysis and recommendation generation using Azure Foundry model endpoint 
“UI for AI” with: recommendation review and editing 
source-to-destination mapping presentation and tweaking 
Artifact generation inside Dynamics 365 cloud: create/update Dataverse solution 
create/update Dataverse schema elements (fields required, tables optional, relationships basic) 
Run history, audit trail, and execution logs 
Established relationships based on the Key in the uploaded tables 
simple data migration based on the input files 
All of the above MUST be driven by MCP execution and guarded by approvals.
Out of Scope (MVP)

Portal rebuild implementation (may only appear as a risk or recommendation) 
Any non-Dynamics target platform 


 4. Users and Roles

Migration Lead (primary): creates runs, uploads source input, reviews recommendations, approves, triggers generation. 
Platform Admin (secondary): configures environment connectivity and guardrails, reviews logs, validates permissions. 
Viewer (optional): read-only access to results and logs. 


 5. End-to-End User Journeys
Journey A: Create a Run and Connect to Target Environment

User creates a new “Run” and provides: run name 
target Dynamics 365 environment reference using environment url/pai keys etc. 
User completes authentication/connection setup before any MCP operations can run (environment bootstrap pattern). 
Acceptance criteria:

User cannot proceed to “Analyze” until a target environment connection is validated. 
System does not store plaintext secrets. 


 Journey B: Wizard Intake (Requirements + Source Data)

Wizard captures user requirements and constraints. 
User uploads several Excel files (MVP) as source metadata input; future option: Access database or SQL database. Important - need to be able to parse the relationships inside the database
System parses and normalizes source metadata. 
Acceptance criteria:

Validation blocks analysis if required inputs are missing. 
The parsed model is stored and versioned per Run. 


 Journey C: AI Analysis (Reasoning and Recommendations)

User triggers “Analyze”. 
System sends the run context + parsed source data + requirements to the AI engine. 
AI returns: recommended Dataverse schema plan (tables, fields, relationships) 
recommended changes (for example “add field X, Y, Z”) 
assumptions and risks 
IMPORTANT: the recommended schema must align to the native tables in Dynamics: Account, Contact, Case etc. this is very important as the goal is to leverage the native Dynamics 365 Capabilities
Results are stored as Run Version N. 
Acceptance criteria:

Every analysis is versioned. 
A readable “what changed between versions” view exists (diff). 


 Journey D: Solution Design (Schema and MCP Readiness)

Phase 4 produced requirements (what we have); Phase 5 transforms those requirements into a concrete D365 solution design using the Solution-Architect agent.

The system MUST:
Call the `Solution-Architect` agent (running on Azure Foundry) with: 
requirements draft from Phase 4 (Migration-Analyst) 
user design guidance (priorities: "prefer custom entities," "map to Account," "prioritize this workflow," etc.) 
The agent returns: a structured D365 solution design (markdown) including: 
mapped Dataverse entities (native or custom) 
field definitions with types and requirements 
relationships and hierarchies 
MCP-ready deployment steps (hints for Phase 6 generation) 
transformation rules for data 
Allow iterative design: user provides guidance → agent produces design → user refines guidance → new design version (each stored as RunVersion N+1)

Acceptance criteria:

Solution-Architect agent produces MCP-ready design specifications. 
Design is stored and versioned separately from requirements. 
User can iterate design with guidance input. 
Clear audit trail: which requirements version → which design version.


 Journey E: Lightweight Approval Gate

User reviews the solution design summary (source count, environment, agents used, timestamps). 
User clicks "Approve for Deployment" with confirmation dialog (shows target D365 environment URL). 
System records approval metadata: who (email), when (timestamp), version. 
System locks the version and enables "Generate" button. 

Acceptance criteria:

Generation is blocked unless an explicit approval exists for that exact version. 
Double-approval is prevented (idempotent). 


 Journey F: Generate Artifacts in Dynamics 365 (MCP Execution)

User triggers “Generate”. 
System uses Dataverse/Dynamics MCP tools to: create a solution 
apply schema changes (fields required; tables optional; relationships basic) 
System produces a step-by-step execution log. 
Acceptance criteria:

Idempotent behavior: repeated “Generate” does not duplicate artifacts. 
Failures are captured with actionable error details. 


 Journey G (Optional MVP Placeholder): Test on Sample Data
The call explicitly suggested multiple iterations and starting with sample data before real migration.
MVP requirement:

Provide a “Test Run” mode that validates mapping and schema assumptions using sample/synthetic data, without performing full production migration. 


 6. Azure Foundry AI Engine Requirements (Mandatory)
AFR-001 AI Model Hosting

The system MUST use an AI model endpoint deployed in Azure Foundry for reasoning. 
AFR-002 API Interaction Pattern

The web application MUST call the Foundry model via a server-side API (browser must not directly call the model endpoint). 
The system MUST support repeated calls (iterative analysis loop), since the workflow expects multiple iterations before anything resembling data movement. 
AFR-003 Responsibilities of the Foundry Model
The Foundry AI engine MUST be responsible for:

interpreting requirements + source metadata together 
proposing Dataverse schema changes (fields, relationships; optionally tables) 
producing a structured mapping representation suitable for the mapping UI 
producing assumptions/risks and clarifying questions for next iteration 
AFR-004 Multi-Model Flexibility (Optional, Not Required for MVP)
The call allowed that “another model” might be needed.
Therefore:

The architecture SHOULD allow swapping or adding models behind the same interface, but MVP can implement a single Foundry model. 


 7. MCP and Dynamics 365 Execution Requirements (Mandatory)
MCP-001 MCP Execution Layer

The system MUST use Dataverse/Dynamics MCP tools as the mechanism to inspect the target environment and apply approved changes. 
MCP-002 Guardrails

The system MUST prevent MCP execution of schema changes unless an approved version exists. 
MCP-003 Artifact Types (MVP Minimum)

Must create/update a Dataverse solution. 
Must create/update fields in existing tables. 
May create/update relationships. 
May create tables if required by the recommendation and within MVP effort. 


 8. Functional Requirements (Consolidated)
FR-001 Run Management

Create, view, list, archive Runs 
Maintain version history (analysis outputs, edits, approvals) 
FR-002 Input Adapters

Excel upload and parsing is required for MVP. 
Access database adapter is a planned future input. 
FR-003 Analysis and Versioning

Trigger analysis using Azure Foundry model 
Store versioned outputs with diffs 
FR-004 Mapping UI

Display source and destination structures 
Allow user adjustments prior to approval 
FR-005 Approval

Explicit approval required and recorded 
FR-006 Artifact Generation

Execute via MCP, generate solution + schema changes 
FR-007 Observability

Detailed logs for: analysis calls 
user edits 
approvals 
MCP execution steps 


 9. Non-Functional Requirements
NFR-001 Security

No plaintext secrets stored 
Least privilege for environment changes 
Auditability of actions 
NFR-002 Reliability

Retry transient failures for AI calls and MCP calls 
Preserve partial execution state with clear reporting 
NFR-003 Performance

Excel parsing and validation must be interactive 
Analysis and generation are asynchronous with progress 
NFR-004 Maintainability

Modular separation: UI 
API 
Foundry AI integration 
MCP integration 
storage 


 10. Logical Data Objects (No Implementation Binding)

Run: metadata + target environment reference 
RunVersion: versioned AI outputs + user edits 
Approval: version approval record 
Job: analyze/generate execution tracking 
LogEntry: step-by-step trace 


 11. Definition of Done (MVP)
MVP is complete when a user can:

connect to a target Dynamics 365 cloud environment, 
upload Excel source metadata, 
run AI analysis using Azure Foundry, 
review and tweak schema and mapping recommendations, 
approve a version, 
generate a solution and schema changes inside a vanilla Dynamics 365 environment using MCP, 
view a complete execution log. 
