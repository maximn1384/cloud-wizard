# CRITICAL ARCHITECTURAL RULES FOR AI AGENT
This is an independent web application (React SPA + Express backend) for AI-assisted Dynamics 365 migration.

1. THE WORKSPACE: Place React components in `src/components/`, hooks in `src/hooks/`, services in `src/services/`, stores in `src/stores/`, types in `src/types/`. Backend code lives in `server/`.
2. THE ARCHITECTURE: This is a standalone SPA (NOT a Power Apps Code App). It uses MSAL for Azure AD authentication and can target any Dynamics 365 cloud environment.
3. DATAVERSE QUERIES: The backend calls the Dataverse Web API directly using Bearer tokens obtained via MSAL on-behalf-of flow. The frontend acquires tokens via `@azure/msal-browser` and passes them to the backend.
4. UI FRAMEWORK: You must strictly use `@fluentui/react-components` (Fluent UI v9). Do not use v8, Tailwind, or custom CSS unless absolutely necessary.
5. AUTHENTICATION: Azure AD via MSAL. The frontend uses interactive login. The backend validates tokens and uses them for Dataverse API calls. No plaintext secrets stored.
6. MCP INTEGRATION: The backend uses MCP SDK (`@modelcontextprotocol/sdk`) for artifact generation in Dataverse. MCP tools are guarded by approval gates.
7. AI ENGINE: Azure Foundry model endpoint called server-side only. Browser must never call the AI endpoint directly.
