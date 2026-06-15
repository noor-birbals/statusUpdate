import { ATLASSIAN_SCOPES, getOAuthConfig } from './auth-config';
import type { SessionPayload } from './session';
import { getSession, setSession } from './session';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
}

interface AtlassianUser {
  name?: string;
  email?: string;
  picture?: string;
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const config = getOAuthConfig();
  if (!config) throw new Error('OAuth is not configured');

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: config.clientId,
    scope: ATLASSIAN_SCOPES,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  return `https://auth.atlassian.com/authorize?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const config = getOAuthConfig();
  if (!config) throw new Error('OAuth is not configured');

  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${body.slice(0, 200)}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const config = getOAuthConfig();
  if (!config) throw new Error('OAuth is not configured');

  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed: ${body.slice(0, 200)}`);
  }

  const data: TokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function getAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to load accessible resources: ${body.slice(0, 200)}`);
  }

  return res.json();
}

async function getAtlassianUser(accessToken: string): Promise<AtlassianUser> {
  const res = await fetch('https://api.atlassian.com/me', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });

  if (!res.ok) return {};
  return res.json();
}

function mapCloudIds(resources: AccessibleResource[]): Record<string, string> {
  const cloudIds: Record<string, string> = {};
  for (const resource of resources) {
    try {
      const host = new URL(resource.url).hostname;
      cloudIds[host] = resource.id;
    } catch {
      // skip invalid URLs
    }
  }
  return cloudIds;
}

export async function createSessionFromCode(
  code: string,
  redirectUri: string,
): Promise<SessionPayload> {
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  const [resources, user] = await Promise.all([
    getAccessibleResources(tokens.access_token),
    getAtlassianUser(tokens.access_token),
  ]);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    userName: user.name,
    userEmail: user.email,
    cloudIds: mapCloudIds(resources),
  };
}

export async function getValidSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;

  if (Date.now() < session.expiresAt - 60_000) {
    return session;
  }

  try {
    const refreshed = await refreshAccessToken(session.refreshToken);
    const updated: SessionPayload = {
      ...session,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    };
    await setSession(updated);
    return updated;
  } catch {
    return null;
  }
}
