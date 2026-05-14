/**
 * MSAL configuration for Azure AD authentication.
 *
 * To configure:
 * 1. Register an app in Azure AD (Entra ID)
 * 2. Add redirect URI: http://localhost:5173 (dev) and your production URL
 * 3. Add API permission: Dynamics CRM → user_impersonation
 * 4. Set the client ID below
 */

export const MSAL_CONFIG = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID ?? 'YOUR_CLIENT_ID',
    authority: import.meta.env.VITE_AZURE_AUTHORITY ?? 'https://login.microsoftonline.com/common',
    redirectUri: import.meta.env.VITE_REDIRECT_URI ?? window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage' as const,
    storeAuthStateInCookie: false,
  },
};

/**
 * Scopes needed for Dynamics 365 / Dataverse access.
 * The org URL is dynamic — set at runtime based on user's chosen environment.
 */
export function getDataverseScopes(orgUrl: string): string[] {
  return [`${orgUrl.replace(/\/+$/, '')}/.default`];
}
