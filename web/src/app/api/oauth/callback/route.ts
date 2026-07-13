import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, domainCheckProviders } from '@/db';
import { exchangeCodeForToken, storeToken, verifyState } from '@/lib/oauth';
import { getCysmoConfigFromEnv } from '@/lib/runtime-env';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state, providerId, redirectUri } = body;

    // Validate required fields
    if (!code || !state || !providerId || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing required fields: code, state, providerId, redirectUri' },
        { status: 400 },
      );
    }

    // Validate state parameter (CSRF protection)
    if (!verifyState(state)) {
      return NextResponse.json(
        { error: 'Invalid or expired state parameter' },
        { status: 401 },
      );
    }

    // Fetch provider details from the database
    const [provider] = await db
      .select()
      .from(domainCheckProviders)
      .where(eq(domainCheckProviders.id, providerId));

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 },
      );
    }

    const cysmoConfig = getCysmoConfigFromEnv();
    if (!cysmoConfig) {
      return NextResponse.json(
        { error: 'Cysmo environment variables not configured' },
        { status: 500 },
      );
    }
    const tokenUrl = `${cysmoConfig.apiBaseUrl.replace(/\/+$/, '')}/oauth/token`;

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForToken(
      code,
      tokenUrl,
      cysmoConfig.clientId,
      cysmoConfig.clientSecret,
      redirectUri,
    );

    // Calculate token expiry date
    const expiryDate = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Store tokens in the database
    await storeToken({
      accessToken: tokenResponse.access_token,
      expiresIn: tokenResponse.expires_in,
      refreshExpiresIn: tokenResponse.refresh_expires_in,
      tokenType: tokenResponse.token_type,
      scope: tokenResponse.scope,
      expiryDate,
      providerId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
