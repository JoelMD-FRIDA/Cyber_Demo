/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('crypto');

function base64urlDecode(input) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('binary');
}

function base64urlToArrayBuffer(input) {
  const binary = base64urlDecode(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function verifyHmacSha256(data, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signatureBytes = base64urlToArrayBuffer(signature);
  const dataBytes = encoder.encode(data);
  return crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);
}

async function verifySessionToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const rawPayload = base64urlDecode(parts[1]);
    const payload = JSON.parse(rawPayload);

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    // Verify HMAC-SHA256 signature (HS256 — jsonwebtoken default)
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return null;

    const headerPayload = `${parts[0]}.${parts[1]}`;
    const isValid = await verifyHmacSha256(headerPayload, parts[2], JWT_SECRET);
    if (!isValid) return null;

    return {
      id: payload.id,
      email: payload.email,
      username: payload.username ?? null,
      role: payload.role,
    };
  } catch (err) {
    console.error('Error in verifySessionToken:', err);
    return null;
  }
}

// Set JWT_SECRET from .env
const fs = require('fs');
const path = require('path');
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('JWT_SECRET=')) {
      const secret = line.substring('JWT_SECRET='.length);
      process.env.JWT_SECRET = secret;
      break;
    }
  }
}

// Mock request object
class MockRequest {
  constructor(url, cookieHeader) {
    this.nextUrl = new URL(url, 'http://localhost:3000');
    this.headers = {};
    if (cookieHeader) {
      this.headers.cookie = cookieHeader;
    }
  }
  
  cookies = {
    get: (name) => {
      if (!this.headers.cookie) return undefined;
      const match = this.headers.cookie.match(new RegExp(`${name}=([^;]*)`));
      return match ? { value: match[1] } : undefined;
    }
  };
}

// Mock NextResponse
class MockNextResponse {
  static next() {
    return { type: 'next' };
  }
  
  static redirect(url) {
    return { type: 'redirect', url };
  }
}

// Mock middleware function
async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/activate', '/impressum', '/datenschutz', '/unauthorized'];
  const API_AUTH_PREFIX = '/api/auth';
  
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route + '/')) ||
    pathname.startsWith(API_AUTH_PREFIX)
  ) {
    return MockNextResponse.next();
  }
  
  const token = request.cookies.get('session')?.value;
  let session = null;
  
  if (token) {
    session = await verifySessionToken(token);
  }
  
  if (!session) {
    const loginUrl = new URL('/login', request.nextUrl.toString());
    loginUrl.searchParams.set('redirect', pathname);
    return MockNextResponse.redirect(loginUrl);
  }
  
  // Import Role and canAccessRoute (mocked for now)
  const Role = { ADMIN: 'admin' };
  const canAccessRoute = () => {
    // Simplified - allow all for testing
    return true;
  };
  
  if (pathname.startsWith('/admin') && session.role !== Role.ADMIN) {
    return MockNextResponse.redirect(new URL('/unauthorized', request.nextUrl.toString()));
  }
  
  if (!canAccessRoute(session.role, pathname)) {
    return MockNextResponse.redirect(new URL('/unauthorized', request.nextUrl.toString()));
  }
  
  return MockNextResponse.next();
}

// Test with our token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImVlZDZmNWFlLWUzZDktNDIyZC04YWI0LWU4NjkzZTE5Mzk5OCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc5ODg4MjEwLCJleHAiOjE3Nzk5NzQ2MTB9.tyHOesgwpyk1LV8KBch9eTkBvy2ojOc6EAJ8ncZxwrA';

const request = new MockRequest('/profile', `session=${token}`);

middleware(request)
  .then(result => {
    console.log('Middleware result:', result);
    if (result.type === 'next') {
      console.log('SUCCESS: User allowed to access /profile');
    } else if (result.type === 'redirect') {
      console.log('FAILURE: User redirected to:', result.url);
    }
  })
  .catch(err => {
    console.error('Error:', err);
  });
