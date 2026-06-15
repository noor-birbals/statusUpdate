import { NextResponse } from 'next/server';
import { getValidSession } from '@/lib/atlassian-oauth';

export async function GET() {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    userName: session.userName,
    userEmail: session.userEmail,
    cloudIds: Object.keys(session.cloudIds),
  });
}
