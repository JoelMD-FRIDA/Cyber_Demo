import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) {
    throw new Error(
      'Encryption key not configured. Set ENCRYPTION_KEY or JWT_SECRET.',
    );
  }
  if (process.env.ENCRYPTION_KEY && raw.length === 64) {
    return Buffer.from(raw, 'hex');
  }
  const salt = Buffer.from('cyber-api-credentials-salt', 'utf-8');
  return crypto.pbkdf2Sync(raw, salt, 100000, 32, 'sha256');
}

export function encryptValue(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptValue(ciphertext: string): string {
  // Minimum base64-encoded size for an encrypted value:
  // iv(16) + authTag(16) = 32 bytes → ceil(32 * 4/3) = 44 chars (with padding)
  if (ciphertext.length < 44) {
    return ciphertext;
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(ciphertext, 'base64');
  } catch {
    return ciphertext;
  }
  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    return ciphertext;
  }
  const key = getEncryptionKey();
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf-8');
}
