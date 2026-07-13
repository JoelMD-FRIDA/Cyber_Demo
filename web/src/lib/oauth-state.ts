import crypto from 'crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { requireJwtSecret } from './runtime-env';

function isOAuthStatePayload(payload: string | JwtPayload): boolean {
  return typeof payload !== 'string' && payload.purpose === 'oauth_state';
}

export function generateState(): string {
  const rawState = crypto.randomBytes(32).toString('hex');
  return jwt.sign(
    { state: rawState, purpose: 'oauth_state', createdAt: Date.now() },
    requireJwtSecret(),
    { expiresIn: '10m' },
  );
}

export function verifyState(state: string): boolean {
  try {
    const payload = jwt.verify(state, requireJwtSecret());
    return isOAuthStatePayload(payload);
  } catch {
    return false;
  }
}
