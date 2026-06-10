// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptString,
  decryptString,
  sign,
  verify,
  importCertificate,
  exportCertificate,
  generateKeyPair,
} from "./pgp";
import * as openpgp from "openpgp";

describe("PGP Service", () => {
  let publicKey: string;
  let privateKey: string;
  const passphrase = "test-passphrase-123";

  beforeAll(async () => {
    const keys = await generateKeyPair("testuser", passphrase);
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
  });

  describe("encryptString / decryptString", () => {
    it("round-trips a normal string", async () => {
      const plaintext = "Hello, PGP World!";
      const encrypted = await encryptString(plaintext, publicKey);
      expect(encrypted).toContain("-----BEGIN PGP MESSAGE-----");

      const decrypted = await decryptString(encrypted, privateKey, passphrase);
      expect(decrypted).toBe(plaintext);
    });

    it("handles empty strings", async () => {
      const encrypted = await encryptString("", publicKey);
      const decrypted = await decryptString(encrypted, privateKey, passphrase);
      expect(decrypted).toBe("");
    });

    it("handles unicode characters", async () => {
      const plaintext = "你好世界 🌍 café résumé naïve";
      const encrypted = await encryptString(plaintext, publicKey);
      const decrypted = await decryptString(encrypted, privateKey, passphrase);
      expect(decrypted).toBe(plaintext);
    });

    it("rejects wrong passphrase", async () => {
      const encrypted = await encryptString("secret data", publicKey);
      await expect(
        decryptString(encrypted, privateKey, "wrong-passphrase")
      ).rejects.toThrow();
    });
  });

  describe("sign / verify", () => {
    it("signs and verifies data", async () => {
      const data = "This is signed data";
      const signature = await sign(data, privateKey, passphrase);
      expect(signature).toContain("-----BEGIN PGP SIGNATURE-----");

      const isValid = await verify(data, signature, publicKey);
      expect(isValid).toBe(true);
    });

    it("fails verification for tampered data", async () => {
      const data = "Original data";
      const signature = await sign(data, privateKey, passphrase);
      const isValid = await verify("Tampered data", signature, publicKey);
      expect(isValid).toBe(false);
    });
  });

  describe("importCertificate", () => {
    it("imports a public key", async () => {
      const result = await importCertificate(publicKey);
      expect(result.fingerprint).toBeDefined();
      expect(result.userIds.length).toBeGreaterThan(0);
      expect(result.isPrivate).toBe(false);
    });

    it("imports a private key", async () => {
      const result = await importCertificate(privateKey);
      expect(result.fingerprint).toBeDefined();
      expect(result.isPrivate).toBe(true);
    });

    it("rejects invalid key", async () => {
      await expect(importCertificate("not-a-valid-key")).rejects.toThrow();
    });
  });

  describe("exportCertificate", () => {
    it("exports a key to armored string", async () => {
      const key = await openpgp.readKey({ armoredKey: publicKey });
      const armored = await exportCertificate(key);
      expect(armored).toContain("-----BEGIN PGP PUBLIC KEY BLOCK-----");
    });
  });
});
