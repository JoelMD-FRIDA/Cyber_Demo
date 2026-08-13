import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedNext = request.nextUrl.searchParams.get('next');
  const next = requestedNext?.startsWith('/') ? requestedNext : '/';
  const redirectUrl = new URL(next, request.url);

  if (!code) {
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('error', 'AUTH_CALLBACK_MISSING_CODE');
    return NextResponse.redirect(redirectUrl);
  }

  const { supabase, getResponse } = createSupabaseRouteClient(request);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('error', 'AUTH_CALLBACK_FAILED');
  }

  const response = NextResponse.redirect(redirectUrl);
  for (const cookie of getResponse().cookies.getAll()) response.cookies.set(cookie);
  return response;
}
