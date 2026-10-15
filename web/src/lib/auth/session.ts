import { createHash, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db/postgres';
import type { Database } from '@/lib/db/types';

export const SESSION_COOKIE = '__Host-frida-domain-check';
export const CSRF_COOKIE = '__Host-frida-domain-check-csrf';
export const TRANSACTION_COOKIE = '__Host-frida-domain-check-oidc';
export const SESSION_SECONDS = 60;
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const opaque = () => randomBytes(32).toString('base64url');
export const cookieOptions = { secure: true, httpOnly: true, sameSite: 'lax' as const, path: '/' };
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
  const result = await sql<Database['public']['Tables']['profiles']['Row'] & { csrf_hash: string }>(
    'SELECT p.*,s.csrf_hash FROM app_sessions s JOIN profiles p ON p.id=s.profile_id WHERE s.id_hash=$1 AND s.expires_at>now() AND p.enabled', [hash(value)]);
  const profile = result.rows[0];
  return profile ? { user: { id: profile.id, email: profile.email }, profile, csrfHash: profile.csrf_hash } : null;
}
