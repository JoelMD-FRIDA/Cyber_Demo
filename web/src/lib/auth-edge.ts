export interface SessionUser {
  id: string;
  email: string;
  username: string | null;
  role: string;
}

import { jwtVerify } from 'jose';

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return null;

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );

    return {
      id: payload.id as string,
      email: payload.email as string,
      username: (payload.username as string) ?? null,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}
