import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export async function POST(request: NextRequest) {
  const { supabase, getResponse } = createSupabaseRouteClient(request);
  await supabase.auth.signOut();
  const response = NextResponse.json({ message: 'Logged out successfully.' });
  for (const cookie of getResponse().cookies.getAll()) response.cookies.set(cookie);
  return response;
}
