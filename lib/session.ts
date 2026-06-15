import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'sprint_session';
export const ACCESS_COOKIE = 'sprint_access';
export const STATE_COOKIE = 'oauth_state';

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userName?: string;
  userEmail?: string;
  cloudIds: Record<string, string>;
}

interface StoredMeta {
  refreshToken: string;
  expiresAt: number;
  userName?: string;
  userEmail?: string;
  cloudIds: Record<string, string>;
}

function cookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function applySessionCookies(response: NextResponse, session: SessionPayload) {
  const { accessToken, refreshToken, expiresAt, userName, userEmail, cloudIds } = session;

  response.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions());
  response.cookies.set(
    SESSION_COOKIE,
    JSON.stringify({ refreshToken, expiresAt, userName, userEmail, cloudIds }),
    cookieOptions(),
  );
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const metaRaw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!accessToken || !metaRaw) return null;

  try {
    const meta = JSON.parse(metaRaw) as StoredMeta;
    return { ...meta, accessToken };
  } catch {
    return null;
  }
}

export async function setSession(session: SessionPayload) {
  const cookieStore = await cookies();
  const { accessToken, refreshToken, expiresAt, userName, userEmail, cloudIds } = session;

  cookieStore.set(ACCESS_COOKIE, accessToken, cookieOptions());
  cookieStore.set(
    SESSION_COOKIE,
    JSON.stringify({ refreshToken, expiresAt, userName, userEmail, cloudIds }),
    cookieOptions(),
  );
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(SESSION_COOKIE);
}

export function appOrigin(requestUrl: string): string {
  if (process.env.ATLASSIAN_REDIRECT_URI) {
    return new URL(process.env.ATLASSIAN_REDIRECT_URI).origin;
  }
  return new URL(requestUrl).origin;
}
