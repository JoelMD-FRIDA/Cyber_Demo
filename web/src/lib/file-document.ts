import { db, fileDocuments } from '@/db';
import { eq } from 'drizzle-orm';

// ── Constants ────────────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'application/pdf',
  'text/csv',
  'application/json',
  'application/xml',
  'text/plain',
  'application/octet-stream',
  'application/pgp-keys',
  'application/pgp-signature',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileUploadOptions {
  reference?: string;
  referenceId?: string;
}

export interface FileDocumentRecord {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hasContents: boolean;
  content: Buffer | null;
  reference: string | null;
  referenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileDocumentInfo {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hasContents: boolean;
  reference: string | null;
  referenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to downcast drizzle values that are non-null at runtime
function toRecord(r: typeof fileDocuments.$inferSelect): FileDocumentRecord {
  return {
    id: r.id,
    name: r.name,
    mimeType: r.mimeType,
    size: r.size as number,
    hasContents: r.hasContents as boolean,
    content: r.content,
    reference: r.reference,
    referenceId: r.referenceId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toInfo(r: typeof fileDocuments.$inferSelect): FileDocumentInfo {
  return {
    id: r.id,
    name: r.name,
    mimeType: r.mimeType,
    size: r.size as number,
    hasContents: r.hasContents as boolean,
    reference: r.reference,
    referenceId: r.referenceId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export class FileNotFoundError extends Error {
  constructor(id: string) {
    super(`File document not found: ${id}`);
    this.name = 'FileNotFoundError';
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateFile(
  name: string,
  mimeType: string,
  size: number,
): void {
  if (!name || name.trim().length === 0) {
    throw new FileValidationError('File name is required');
  }
  if (name.length > 400) {
    throw new FileValidationError(
      'File name must be at most 400 characters',
    );
  }

  const normalizedMime = mimeType.toLowerCase().trim();
  if (
    !ALLOWED_MIME_TYPES.includes(normalizedMime as AllowedMimeType)
  ) {
    throw new FileValidationError(
      `Unsupported MIME type: '${mimeType}'. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    );
  }

  if (size > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `File size ${size} bytes exceeds maximum of ${MAX_FILE_SIZE} bytes (10 MB)`,
    );
  }

  if (size < 0) {
    throw new FileValidationError('File size cannot be negative');
  }
}

// ── Upload ───────────────────────────────────────────────────────────────────

export async function uploadFile(
  name: string,
  mimeType: string,
  content: Buffer,
  options?: FileUploadOptions,
): Promise<FileDocumentInfo> {
  const size = content.length;
  validateFile(name, mimeType, size);

  const [record] = await db
    .insert(fileDocuments)
    .values({
      name,
      mimeType,
      size,
      hasContents: true,
      content,
      reference: options?.reference ?? null,
      referenceId: options?.referenceId ?? null,
    })
    .returning();

  return toInfo(record);
}

// ── Download (full record with content) ──────────────────────────────────────

export async function downloadFile(
  id: string,
): Promise<FileDocumentRecord | null> {
  const [record] = await db
    .select()
    .from(fileDocuments)
    .where(eq(fileDocuments.id, id))
    .limit(1);

  return record ? toRecord(record) : null;
}

// ── Get metadata only (no content) ──────────────────────────────────────────

export async function getFileInfo(
  id: string,
): Promise<FileDocumentInfo | null> {
  const [record] = await db
    .select({
      id: fileDocuments.id,
      name: fileDocuments.name,
      mimeType: fileDocuments.mimeType,
      size: fileDocuments.size,
      hasContents: fileDocuments.hasContents,
      reference: fileDocuments.reference,
      referenceId: fileDocuments.referenceId,
      createdAt: fileDocuments.createdAt,
      updatedAt: fileDocuments.updatedAt,
    })
    .from(fileDocuments)
    .where(eq(fileDocuments.id, id))
    .limit(1);

  return record
    ? {
        id: record.id,
        name: record.name,
        mimeType: record.mimeType,
        size: record.size as number,
        hasContents: record.hasContents as boolean,
        reference: record.reference,
        referenceId: record.referenceId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }
    : null;
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteFile(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(fileDocuments)
    .where(eq(fileDocuments.id, id))
    .returning({ id: fileDocuments.id });

  return !!deleted;
}
