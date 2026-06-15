import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/lib/atlassian-oauth';
import { getOAuthConfig, getRedirectUri } from '@/lib/auth-config';
import { STATE_COOKIE } from '@/lib/session';

export async function GET(request: NextRequest) {
  const config = getOAuthConfig();
  if (!config) {
    return NextResponse.redirect(new URL('/?error=oauth_not_configured', request.url));
  }

  const state = crypto.randomUUID();
  const redirectUri = getRedirectUri(request.nextUrl.origin);
  const authorizeUrl = buildAuthorizeUrl(redirectUri, state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return response;
}
