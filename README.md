# Cloud Wizard

AI-assisted migration tool for moving on-premise Dynamics 365 applications to D365 cloud (Dataverse). Upload your source data as Excel files, let AI analyze and propose a schema mapping to native D365 tables, review and approve the plan, then generate the schema directly in your target environment.

## Prerequisites

- Node.js 20+
- An Azure AD (Entra ID) app registration with:
  - **Type:** Single-page application (SPA)
  - **Redirect URI:** `http://localhost:5174`
  - **API permission:** Dynamics CRM → `user_impersonation`
- Access to a Dynamics 365 / Dataverse environment

## Setup

```bash
git clone https://github.com/maximn1384/cloud-wizard.git
cd cloud-wizard
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_AZURE_CLIENT_ID=<your app registration client id>
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/<your-tenant-id>
VITE_REDIRECT_URI=http://localhost:5174
```

### Creating an App Registration

1. Go to [Azure Portal → Entra ID → App registrations → New registration](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade)
2. Name: anything (e.g. "Cloud Wizard")
3. Supported account types: Single tenant (or multi-tenant if collaborating across tenants)
4. Redirect URI: **Single-page application** → `http://localhost:5174`
5. After creating, copy the **Application (client) ID** into `.env`
6. Go to **API permissions → Add → Dynamics CRM → Delegated → `user_impersonation`**
7. Grant admin consent (or have an admin do it)

## Running

```bash
npm run dev
```

This starts both:
- **Frontend** (Vite) at http://localhost:5174
- **Backend** (Express) at http://localhost:3001

The frontend proxies `/api` requests to the backend automatically.

## Project Structure

```
src/                    → React frontend (Vite + TypeScript)
  components/layout/    → Shell, Sidebar, WizardStepper
  components/wizard/    → One component per wizard step
  services/             → API client, MSAL auth, config
  stores/               → Zustand state (runs, UI)
  types/                → TypeScript interfaces

server/                 → Express backend
  routes/               → API endpoints (runs, upload, ai, mcp)
  services/             → DataverseClient, run storage

plan.md                 → Detailed implementation plan (9 phases)
requirements.md         → Product requirements
instructions.md         → AI agent coding rules
```

## Wizard Flow

1. **Connect** — Sign in with Microsoft, enter target D365 environment URL, validate connection
2. **Upload** — Drag-and-drop Excel files with source data
3. **Analyze** — AI proposes schema mapping to native D365 tables
4. **Review** — Inspect AI recommendations, edit mappings
5. **Approve** — Lock the version for generation
6. **Generate** — Create tables/fields in Dataverse via API
7. **Logs** — Full audit trail of all operations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, Fluent UI v9 |
| State | Zustand |
| Auth | MSAL (@azure/msal-browser) |
| Backend | Express 5, tsx |
| Excel | SheetJS (xlsx) |
| AI | Azure OpenAI SDK (Azure Foundry endpoint) |
| Dataverse | Direct Web API calls with Bearer tokens |

## Contributing

- Each developer uses their own `.env` (not committed to git)
- See `plan.md` for the full implementation roadmap
- Current status: Phases 1-3 complete (foundation, connection, upload)
