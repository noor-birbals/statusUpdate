import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'sprint_session';
export const STATE_COOKIE = 'oauth_state';

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userName?: string;
  userEmail?: string;
  cloudIds: Record<string, string>;
}

export interface StoredSession {
  refreshToken: string;
  userName?: string;
  userEmail?: string;
  cloudIds: Record<string, string>;
}

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

function cookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function applySessionCookies(response: NextResponse, session: SessionPayload) {
  cacheAccessToken(session.refreshToken, session.accessToken, session.expiresAt);
  const stored: StoredSession = {
    refreshToken: session.refreshToken,
    userName: session.userName,
    userEmail: session.userEmail,
    cloudIds: session.cloudIds,
  };
  response.cookies.set(SESSION_COOKIE, JSON.stringify(stored), cookieOptions());
}

export async function getStoredSession(): Promise<StoredSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function getCachedAccessToken(refreshToken: string) {
  return tokenCache.get(refreshToken) ?? null;
}

export function cacheAccessToken(refreshToken: string, accessToken: string, expiresAt: number) {
  tokenCache.set(refreshToken, { accessToken, expiresAt });
}

export async function clearSession() {
  const stored = await getStoredSession();
  if (stored) tokenCache.delete(stored.refreshToken);

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function appOrigin(requestUrl: string): string {
  if (process.env.ATLASSIAN_REDIRECT_URI) {
    return new URL(process.env.ATLASSIAN_REDIRECT_URI).origin;
  }
  return new URL(requestUrl).origin;
}
