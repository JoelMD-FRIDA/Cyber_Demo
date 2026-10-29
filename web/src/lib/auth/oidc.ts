import * as oidc from 'openid-client';
import { hash, opaque, encrypt, decrypt, appOrigin, safeReturnPath, SESSION_SECONDS, RENEWAL_SECONDS } from './session';
import { withWrites, sql } from '@/lib/db/postgres';

let cached: { config: oidc.Configuration; until: number } | undefined;
// The shared identity service is CPU limited; client-secret verification can
// exceed four seconds when two people sign in together. Never replay code grants.
const IDENTITY_TIMEOUT_MS = 30_000;
function required(value: string | undefined) {
  if (!value?.trim()) throw new Error('Central login configuration is incomplete.');
  return value.trim();
}
export function oidcSettings() {
  const issuer = required(process.env.OIDC_ISSUER);
  const parsed = new URL(issuer);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search)
    throw new Error('Central login requires an exact HTTPS issuer.');
  return { issuer, clientId: required(process.env.OIDC_CLIENT_ID),
    secret: required(process.env.OIDC_CLIENT_SECRET),
    entitlementClaim: required(process.env.OIDC_REQUIRED_ENTITLEMENT_CLAIM),
    entitlement: required(process.env.OIDC_REQUIRED_ENTITLEMENT_VALUE) };
}
export async function oidcConfiguration() {
  if (cached && cached.until > Date.now()) return cached.config;
  const settings = oidcSettings();
  const origin = new URL(settings.issuer).origin;
  const config = await oidc.discovery(new URL(settings.issuer),settings.clientId,
    { id_token_signed_response_alg: 'RS256' },oidc.ClientSecretBasic(settings.secret), {
      timeout: IDENTITY_TIMEOUT_MS / 1000,
      execute: [oidc.enableNonRepudiationChecks],
      [oidc.customFetch]: async (url, options) => {
        if (new URL(String(url)).origin !== origin) throw new Error('Untrusted identity endpoint.');
        const signal = options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(IDENTITY_TIMEOUT_MS)]) : AbortSignal.timeout(IDENTITY_TIMEOUT_MS);
        const response = await fetch(url,{ ...options, signal, body:options.body as BodyInit, redirect: 'error', cache: 'no-store' });
        const reader=response.body?.getReader();
        if(!reader)return response;
        try {
          const parts:Uint8Array[]=[];let size=0;
          while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
            if(size>1024*1024)throw new Error('Identity response exceeds the limit.');parts.push(part.value);}
          return new Response(Buffer.concat(parts),{status:response.status,headers:response.headers});
        }finally{void reader.cancel().catch(()=>{});}
      },
    });
  const metadata = config.serverMetadata();
  if (metadata.issuer !== settings.issuer) throw new Error('Identity issuer mismatch.');
  for (const endpoint of [metadata.authorization_endpoint,metadata.token_endpoint,metadata.jwks_uri]) {
    if (!endpoint || new URL(endpoint).origin !== origin) throw new Error('Untrusted identity endpoint.');
  }
  cached = { config, until: Date.now()+60_000 };
  return config;
}
export function acceptedClaims(claims: Record<string, unknown>) {
  const settings = oidcSettings();
  const entitlement = claims[settings.entitlementClaim];
  if (claims.iss !== settings.issuer ||
      !(claims.aud === settings.clientId || (Array.isArray(claims.aud) && claims.aud.includes(settings.clientId) && claims.azp === settings.clientId)) ||
      (claims.azp !== undefined && claims.azp !== settings.clientId) ||
      typeof claims.exp !== 'number' || claims.exp*1000 <= Date.now() ||
      (typeof claims.nbf === 'number' && claims.nbf*1000>Date.now()) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 512 ||
      claims.email_verified !== true || typeof claims.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || claims.email.length > 254 ||
      !(entitlement === settings.entitlement || (Array.isArray(entitlement) && entitlement.includes(settings.entitlement))))
    throw new Error('This identity is not authorized for the sandbox.');
  return { issuer: settings.issuer, subject: claims.sub, email: claims.email.toLowerCase(),
    expires: new Date(Date.now()+SESSION_SECONDS*1000) };
}
interface RenewalBinding { issuer:string; subject:string; profileId:string; expires:number; }
function renewalBinding(value:string|undefined,interactive=false):RenewalBinding {
  if (!value || value.length>4096) throw new Error('Sign in again to renew your session.');
  const binding=JSON.parse(decrypt(value)) as RenewalBinding;
  if (binding.issuer!==oidcSettings().issuer || typeof binding.subject!=='string' || !binding.subject ||
      typeof binding.profileId!=='string' || !/^[a-f0-9-]{36}$/.test(binding.profileId) ||
      !Number.isSafeInteger(binding.expires) || binding.expires<=Date.now()-(interactive?24*3600*1000:0) || binding.expires>Date.now()+RENEWAL_SECONDS*1000)
    throw new Error('Session renewal binding expired.');
  return binding;
}
// Only explicitly allowed client-rendered shells may resume from this context.
// API identity still requires an unexpired session and an enabled local account.
export function hasRenewalContext(value:string|undefined) {
  try {renewalBinding(value,true);return true;}catch{return false;}
}
export async function renewalForActiveSession(profileId:string,value:string|undefined) {
  try {if(renewalBinding(value).profileId===profileId)return undefined;}catch{}
  // Upgrade a currently authenticated browser without demanding another sign-in.
  // Identity comes from its existing issuer/subject mapping, never from an email.
  const result=await sql<{issuer:string;subject:string}>(
    'SELECT issuer,subject FROM oidc_identities WHERE profile_id=$1 AND issuer=$2',[profileId,oidcSettings().issuer]);
  if(result.rows.length!==1)throw new Error('No unique identity mapping for the active session.');
  return encrypt(JSON.stringify({...result.rows[0],profileId,expires:Date.now()+RENEWAL_SECONDS*1000}));
}
export async function startLogin(returnPath: string | null, renewal?:{cookie:string|undefined; interactive?:boolean}) {
  const binding=renewal ? renewalBinding(renewal.cookie,renewal.interactive) : undefined;
  if(binding && renewal?.interactive)binding.expires=Date.now()+RENEWAL_SECONDS*1000;
  const config = await oidcConfiguration();
  const state = oidc.randomState(), nonce = oidc.randomNonce(), verifier = oidc.randomPKCECodeVerifier();
  const transaction = opaque();
  await withWrites(async db => {
    await db.query('DELETE FROM oidc_transactions WHERE expires_at<=now()');
    const count = await db.query('SELECT count(*)::int AS total FROM oidc_transactions');
    if (count.rows[0].total >= 1000) throw new Error('Login is temporarily unavailable.');
    await db.query('INSERT INTO oidc_transactions(id_hash,state_hash,encrypted,return_path,expires_at) VALUES($1,$2,$3,$4,now()+interval \'5 minutes\')',
      [hash(transaction),hash(state),encrypt(JSON.stringify({ nonce,verifier,binding,interactive:renewal?.interactive===true })),binding ? '/auth/renew/complete'+(renewal?.interactive?'?popup=1':'') : safeReturnPath(returnPath)]);
  });
  const url = oidc.buildAuthorizationUrl(config,{ redirect_uri: appOrigin()+'/auth/callback',
    scope: 'openid profile email groups', state, nonce, ...(renewal ? {prompt:renewal.interactive?'login':'none'} : {}),
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256' });
  return { transaction, url };
}
export async function finishLogin(url: URL, transaction: string | undefined) {
  const state = url.searchParams.get('state');
  if (!transaction || !/^[A-Za-z0-9_-]{43}$/.test(transaction) || !state ||
      url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1)
    throw new Error('Invalid login transaction.');
  const entry = await withWrites(async db => {
    const result = await db.query('DELETE FROM oidc_transactions WHERE id_hash=$1 AND state_hash=$2 AND expires_at>now() RETURNING *', [hash(transaction),hash(state)]);
    if (result.rows.length !== 1) throw new Error('Expired or replayed login transaction.');
    return result.rows[0];
  });
  const { nonce, verifier, binding, interactive } = JSON.parse(decrypt(entry.encrypted)) as {nonce:string;verifier:string;binding?:RenewalBinding;interactive?:boolean};
  const callback = new URL(appOrigin()+'/auth/callback');
  callback.search = url.search;
  const tokens = await oidc.authorizationCodeGrant(await oidcConfiguration(),callback,
    { expectedState: state, expectedNonce: nonce, pkceCodeVerifier: verifier, idTokenExpected: true });
  const identity = acceptedClaims(tokens.claims() as Record<string,unknown>);
  if (binding && (binding.expires<=Date.now() || identity.issuer!==binding.issuer || identity.subject!==binding.subject))
    throw new Error('Session renewal cannot change the signed-in identity.');
  const session = opaque(), csrf = opaque();
  let renewalCookie:string|undefined;
  await withWrites(async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([identity.issuer,identity.subject])]);
    const mapping = await db.query('SELECT p.* FROM oidc_identities i JOIN profiles p ON p.id=i.profile_id WHERE i.issuer=$1 AND i.subject=$2', [identity.issuer,identity.subject]);
    let profile = mapping.rows[0];
    if (!profile) {
      // Email collisions fail; email alone never links two identities.
      const created = await db.query('INSERT INTO profiles(email) VALUES($1) RETURNING *',[identity.email]);
      profile = created.rows[0];
      await db.query('INSERT INTO oidc_identities(issuer,subject,profile_id) VALUES($1,$2,$3)',[identity.issuer,identity.subject,profile.id]);
    }
    if (!profile.enabled || binding && profile.id!==binding.profileId) throw new Error('This account is disabled or differs from the original session.');
    if (!binding || interactive) renewalCookie=encrypt(JSON.stringify({issuer:identity.issuer,subject:identity.subject,profileId:profile.id,expires:Date.now()+RENEWAL_SECONDS*1000}));
    await db.query('DELETE FROM app_sessions WHERE expires_at<=now()');
    await db.query('INSERT INTO app_sessions(id_hash,profile_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)', [hash(session),profile.id,hash(csrf),identity.expires]);
  });
  // Access/refresh/ID tokens are not retained. The validated login establishes
  // the app session; local enablement and roles are checked on every request.
  return { session, csrf, renewalCookie, returnPath: safeReturnPath(entry.return_path) };
}
