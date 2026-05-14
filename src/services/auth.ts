import {
  PublicClientApplication,
  type AuthenticationResult,
  type AccountInfo,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { MSAL_CONFIG, getDataverseScopes } from './dataverse';

let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;
let redirectHandled = false;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(MSAL_CONFIG);
    initPromise = msalInstance.initialize();
  }
  await initPromise;
  if (!redirectHandled) {
    redirectHandled = true;
    await msalInstance.handleRedirectPromise();
  }
  return msalInstance;
}

/**
 * Sign in the user interactively (popup).
 */
export async function signIn(): Promise<AccountInfo | null> {
  const instance = await getMsalInstance();
  try {
    const result = await instance.loginPopup({
      scopes: ['openid', 'profile', 'User.Read'],
    });
    const account = result.account ?? instance.getAllAccounts()[0] ?? null;
    if (account) {
      instance.setActiveAccount(account);
    }
    return account;
  } catch (err) {
    console.error('Sign in failed:', err);
    return null;
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  const instance = await getMsalInstance();
  await instance.logoutPopup();
}

/**
 * Get the currently signed-in account (if any).
 */
export async function getAccount(): Promise<AccountInfo | null> {
  const instance = await getMsalInstance();
  const accounts = instance.getAllAccounts();
  return accounts[0] ?? null;
}

/**
 * Acquire an access token for a specific Dynamics 365 org URL.
 * Tries silent acquisition first, falls back to popup if needed.
 */
export async function acquireDataverseToken(
  orgUrl: string
): Promise<string | null> {
  const instance = await getMsalInstance();
  const accounts = instance.getAllAccounts();
  if (accounts.length === 0) return null;

  const scopes = getDataverseScopes(orgUrl);
  const request = { scopes, account: accounts[0] };

  try {
    const result: AuthenticationResult =
      await instance.acquireTokenSilent(request);
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      try {
        const result = await instance.acquireTokenPopup({ scopes });
        return result.accessToken;
      } catch (popupErr) {
        console.error('Token popup failed:', popupErr);
        return null;
      }
    }
    console.error('Token acquisition failed:', err);
    return null;
  }
}

/**
 * Check if the user is currently authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const account = await getAccount();
  return account !== null;
}
