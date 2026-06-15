import { NextRequest, NextResponse } from 'next/server';
import { createSessionFromCode } from '@/lib/atlassian-oauth';
import { getRedirectUri } from '@/lib/auth-config';
import { setSession, STATE_COOKIE } from '@/lib/session';

function redirectWithClearedState(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = request.cookies.get(STATE_COOKIE)?.value;

  if (error) {
    return redirectWithClearedState(request, `/?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state || !savedState || state !== savedState) {
    return redirectWithClearedState(request, '/?error=invalid_state');
  }

  try {
    const redirectUri = getRedirectUri(request.nextUrl.origin);
    const session = await createSessionFromCode(code, redirectUri);
    await setSession(session);
    return redirectWithClearedState(request, '/?auth=success');
  } catch (e) {
    const message = e instanceof Error ? e.message : 'auth_failed';
    return redirectWithClearedState(request, `/?error=${encodeURIComponent(message)}`);
  }
}
