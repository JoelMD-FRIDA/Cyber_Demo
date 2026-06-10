import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, domainCheckProviders } from '@/db';
import { exchangeCodeForToken, storeToken, verifyState } from '@/lib/oauth';
import { decryptString } from '@/lib/pgp';

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

    // Determine token endpoint
    const baseUrl = provider.websiteUrl || process.env.CYSMO_API_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Provider token endpoint not configured' },
        { status: 500 },
      );
    }
    const tokenUrl = `${baseUrl.replace(/\/+$/, '')}/oauth/token`;

    // Resolve client credentials
    const clientId = process.env.OAUTH_CLIENT_ID || process.env.CYSMO_CLIENT_ID || '';
    let clientSecret = process.env.OAUTH_CLIENT_SECRET || process.env.CYSMO_CLIENT_SECRET || '';

    // If provider has an encrypted API key, use it as the client secret
    if (provider.apiKeyEncrypted) {
      const privateKeyArmored = process.env.PGP_PRIVATE_KEY;
      const passphrase = process.env.PGP_PASSPHRASE;
      if (privateKeyArmored && passphrase) {
        clientSecret = await decryptString(provider.apiKeyEncrypted, privateKeyArmored, passphrase);
      }
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'OAuth client credentials not configured' },
        { status: 500 },
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForToken(
      code,
      tokenUrl,
      clientId,
      clientSecret,
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
