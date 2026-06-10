import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = '24h';
const SALT_ROUNDS = 10;

export interface JWTPayload {
  id: string;
  email: string;
  username: string | null;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateJWT(user: {
  id: string;
  email: string;
  username: string | null;
  role: string;
}): string {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
}

export async function verifyJWT(
  token: string,
): Promise<{ id: string; email: string; username: string | null; role: string }> {
  const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
  return { id: decoded.id, email: decoded.email, username: decoded.username ?? null, role: decoded.role };
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
