import { NextRequest, NextResponse } from 'next/server';
import { createSessionFromCode } from '@/lib/atlassian-oauth';
import { getRedirectUri } from '@/lib/auth-config';
import { applySessionCookies, appOrigin, STATE_COOKIE } from '@/lib/session';

function redirectHome(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, appOrigin(request.url)));
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
    return redirectHome(request, `/?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state || !savedState || state !== savedState) {
    return redirectHome(request, '/?error=invalid_state');
  }

  try {
    const redirectUri = getRedirectUri(appOrigin(request.url));
    const session = await createSessionFromCode(code, redirectUri);
    const response = redirectHome(request, '/?auth=success');
    applySessionCookies(response, session);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'auth_failed';
    return redirectHome(request, `/?error=${encodeURIComponent(message)}`);
  }
}
