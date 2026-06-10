import * as openpgp from "openpgp";
import { readFile, writeFile } from "fs/promises";

/**
 * Encrypt a plaintext string using a public key.
 * Returns armored ciphertext.
 */
export async function encryptString(
  plaintext: string,
  publicKeyArmored: string
): Promise<string> {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
  const encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ text: plaintext }),
    encryptionKeys: publicKey,
  });
  return encrypted;
}

/**
 * Decrypt an armored ciphertext string using a private key.
 */
export async function decryptString(
  ciphertextArmored: string,
  privateKeyArmored: string,
  passphrase: string
): Promise<string> {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
    passphrase,
  });
  const { data: decrypted } = await openpgp.decrypt({
    message: await openpgp.readMessage({ armoredMessage: ciphertextArmored }),
    decryptionKeys: privateKey,
  });
  return decrypted;
}

/**
 * Encrypt a file from inputPath to outputPath using a public key.
 */
export async function encryptFile(
  inputPath: string,
  outputPath: string,
  publicKeyArmored: string
): Promise<void> {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
  const input = await readFile(inputPath);
  const encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ binary: input }),
    encryptionKeys: publicKey,
    format: "armored",
  });
  await writeFile(outputPath, encrypted);
}

/**
 * Decrypt a file from inputPath to outputPath using a private key.
 */
export async function decryptFile(
  inputPath: string,
  outputPath: string,
  privateKeyArmored: string,
  passphrase: string
): Promise<void> {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
    passphrase,
  });
  const input = await readFile(inputPath, "utf-8");
  const { data: decrypted } = await openpgp.decrypt({
    message: await openpgp.readMessage({ armoredMessage: input }),
    decryptionKeys: privateKey,
    format: "binary",
  });
  await writeFile(outputPath, decrypted);
}

/**
 * Create a detached signature for data using a private key.
 */
export async function sign(
  data: string,
  privateKeyArmored: string,
  passphrase: string
): Promise<string> {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
    passphrase,
  });
  const detachedSignature = await openpgp.sign({
    message: await openpgp.createMessage({ text: data }),
    signingKeys: privateKey,
    detached: true,
  });
  return detachedSignature;
}

/**
 * Verify a detached signature against data using a public key.
 */
export async function verify(
  data: string,
  signature: string,
  publicKeyArmored: string
): Promise<boolean> {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
  const { signatures } = await openpgp.verify({
    message: await openpgp.createMessage({ text: data }),
    signature: await openpgp.readSignature({ armoredSignature: signature }),
    verificationKeys: publicKey,
  });
  try {
    await signatures[0].verified;
    return true;
  } catch {
    return false;
  }
}

/**
 * Import an armored key and return metadata.
 */
export async function importCertificate(armoredKey: string): Promise<{
  fingerprint: string;
  userIds: string[];
  isPrivate: boolean;
}> {
  let key: openpgp.Key;
  try {
    key = await openpgp.readKey({ armoredKey });
  } catch {
    key = await openpgp.readPrivateKey({ armoredKey });
  }
  const userIds = key.getUserIDs().map((id) => id);
  return {
    fingerprint: key.getFingerprint(),
    userIds,
    isPrivate: key.isPrivate(),
  };
}

/**
 * Export a key to armored string.
 */
export async function exportCertificate(key: openpgp.Key): Promise<string> {
  return key.armor();
}

/**
 * Generate a new PGP key pair.
 */
export async function generateKeyPair(
  userId: string,
  passphrase: string
): Promise<{ publicKey: string; privateKey: string }> {
  const { publicKey, privateKey } = await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519Legacy",
    userIDs: [{ name: userId, email: `${userId}@example.com` }],
    passphrase,
  });
  return { publicKey, privateKey };
}
