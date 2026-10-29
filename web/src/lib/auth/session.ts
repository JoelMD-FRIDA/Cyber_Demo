import { createHash, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { sql, withWrites } from '@/lib/db/postgres';
import type { Database } from '@/lib/db/types';

export const SESSION_COOKIE = '__Host-frida-domain-check';
export const CSRF_COOKIE = '__Host-frida-domain-check-csrf';
export const TRANSACTION_COOKIE = '__Host-frida-domain-check-oidc';
// The OIDC token proves identity at sign-in. The application session has its own
// lifetime, refreshed during use; it must not depend on minute-by-minute SSO.
export const SESSION_SECONDS = 7 * 86400;
// This binding permits reauthentication only; private APIs still require a live session.
export const RENEWAL_COOKIE = '__Host-frida-domain-check-renew';
export const RENEWAL_SECONDS = 3600;
export const RENEWAL_COOKIE_SECONDS = 86400;
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const opaque = () => randomBytes(32).toString('base64url');
export const cookieOptions = { secure: true, httpOnly: true, sameSite: 'lax' as const, path: '/' };
export type LoginMode = 'login' | 'silent' | 'interactive';
export function transactionCookieName(state: string, mode: LoginMode = 'login') {
  return `${TRANSACTION_COOKIE}-${mode}-${hash(state).slice(0,32)}`;
}
export function equal(a: string | undefined | null, b: string | undefined | null) {
  if (!a || !b) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left,right);
}
export function appOrigin(): string {
  const value = process.env.APP_ORIGIN ?? '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password)
    throw new Error('Configure the canonical HTTPS application origin.');
  return value;
}
export function safeReturnPath(value: string | null | undefined) {
  if (!value || value.length>4096 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  const url = new URL(value,appOrigin());
  return url.origin === appOrigin() ? url.pathname+url.search : '/';
}
function key() {
  const decoded = Buffer.from(process.env.SESSION_ENCRYPTION_KEY ?? '', 'base64');
  if (decoded.length !== 32) throw new Error('Configure a 32-byte session encryption key.');
  return decoded;
}
export function encrypt(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key(),iv);
  return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64url');
}
export function decrypt(value: string) {
  const bytes = Buffer.from(value,'base64url');
  const decipher = createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString('utf8');
}
export async function sessionForCookie(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const result = await sql<Database['public']['Tables']['profiles']['Row'] & { csrf_hash: string; session_expires_at: Date }>(
    'SELECT p.*,s.csrf_hash,s.expires_at AS session_expires_at FROM app_sessions s JOIN profiles p ON p.id=s.profile_id WHERE s.id_hash=$1 AND s.expires_at>now() AND p.enabled', [hash(value)]);
  const profile = result.rows[0];
  return profile ? { user: { id: profile.id, email: profile.email }, profile, csrfHash: profile.csrf_hash,
    expiresAt:new Date(profile.session_expires_at).getTime() } : null;
}

export async function extendActiveSession(value: string, expiresAt: number) {
  // Write at most once a day. Conditional UPDATE cannot revive logout, expiry or
  // a disabled account, including when another request changed it meanwhile.
  if (expiresAt > Date.now() + (SESSION_SECONDS - 86400) * 1000) return expiresAt;
  const result = await withWrites(db => db.query<{ expires_at: Date }>(
    `UPDATE app_sessions s SET expires_at=now()+make_interval(secs => $2)
     FROM profiles p WHERE s.id_hash=$1 AND s.profile_id=p.id AND p.enabled
     AND s.expires_at>now() RETURNING s.expires_at`, [hash(value), SESSION_SECONDS]));
  return result.rows[0] ? new Date(result.rows[0].expires_at).getTime() : undefined;
}
