export const ATLASSIAN_SCOPES = [
  'read:jira-work',
  'read:jira-user',
  'offline_access',
].join(' ');

export function getOAuthConfig() {
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getRedirectUri(origin: string): string {
  return process.env.ATLASSIAN_REDIRECT_URI || `${origin.replace(/\/$/, '')}/api/auth/callback`;
}
