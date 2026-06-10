// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encryptValue, decryptValue } from './crypto';
import {
  createFixturePgpCertificate,
  createFixtureApiCredential,
} from '@/test/fixtures';

// ── Crypto Tests ──────────────────────────────────────────────────────────────

describe('crypto', () => {
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = testSecret;
  });

  describe('encryptValue / decryptValue', () => {
    it('round-trips a password string', () => {
      const password = 'MySecretPassword123!@#';
      const encrypted = encryptValue(password);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(password);
      expect(encrypted.length).toBeGreaterThan(24);

      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe(password);
    });

    it('produces different ciphertext each time (random IV)', () => {
      const password = 'same-password';
      const encrypted1 = encryptValue(password);
      const encrypted2 = encryptValue(password);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('handles empty string', () => {
      const encrypted = encryptValue('');
      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe('');
    });

    it('handles special characters', () => {
      const password = 'abc123!@#$%^&*()_+-=[]{}|;:,.<>?~`你好🌍';
      const encrypted = encryptValue(password);
      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe(password);
    });

    it('returns plaintext as-is for unencrypted values', () => {
      const result = decryptValue('plaintext-value');
      expect(result).toBe('plaintext-value');
    });

    it('returns short string as-is for unencrypted values', () => {
      const result = decryptValue('abc');
      expect(result).toBe('abc');
    });

    it('fails when ENCRYPTION_KEY and JWT_SECRET are both unset', () => {
      delete process.env.ENCRYPTION_KEY;
      delete process.env.JWT_SECRET;
      expect(() => encryptValue('test')).toThrow('Encryption key not configured');
    });

    it('uses a 64-char hex ENCRYPTION_KEY directly', () => {
      process.env.ENCRYPTION_KEY = testSecret;
      const encrypted = encryptValue('direct-key-test');
      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe('direct-key-test');
    });

    it('derives key from JWT_SECRET when ENCRYPTION_KEY is unset', () => {
      delete process.env.ENCRYPTION_KEY;
      process.env.JWT_SECRET = 'some-jwt-secret-for-derivation';
      const encrypted = encryptValue('jwt-derived-key');
      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe('jwt-derived-key');
    });
  });
});

// ── Fixture Tests ─────────────────────────────────────────────────────────────

describe('fixtures', () => {
  describe('createFixturePgpCertificate', () => {
    it('creates a public certificate fixture', () => {
      const cert = createFixturePgpCertificate(1);
      expect(cert.certificateType).toBe('public');
      expect(cert.emailAddress).toBe('pgp-user1@example.com');
      expect(cert.reference).toContain('AABBCCDD');
      expect(cert.passphraseEncrypted).toBeNull();
      expect(cert.fileDocumentId).toBeNull();
    });

    it('creates a private certificate fixture for even seq', () => {
      const cert = createFixturePgpCertificate(2);
      expect(cert.certificateType).toBe('private');
      expect(cert.emailAddress).toBe('pgp-user2@example.com');
      expect(cert.passphraseEncrypted).toBe('encrypted-passphrase-placeholder');
    });

    it('creates distinct certificates for different seq', () => {
      const cert1 = createFixturePgpCertificate(1);
      const cert2 = createFixturePgpCertificate(2);
      expect(cert1.reference).not.toBe(cert2.reference);
      expect(cert1.emailAddress).not.toBe(cert2.emailAddress);
    });
  });

  describe('createFixtureApiCredential', () => {
    it('creates a credential with encrypted-looking password', () => {
      const cred = createFixtureApiCredential(1);
      expect(cred.apiUrl).toContain('api.example1.com');
      expect(cred.oauthUrl).toContain('auth.example1.com');
      expect(cred.passwordEncrypted).toContain('encrypted_password_');
    });

    it('creates distinct credentials for different seq', () => {
      const cred1 = createFixtureApiCredential(1);
      const cred2 = createFixtureApiCredential(2);
      expect(cred1.apiUrl).not.toBe(cred2.apiUrl);
      expect(cred1.username).not.toBe(cred2.username);
    });
  });
});
