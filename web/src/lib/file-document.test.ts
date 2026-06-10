// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted shared state for DB mock ─────────────────────────────────────────

const testState = vi.hoisted(() => {
  const store: Array<{
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
  }> = [];

  let lastEqValue: unknown = undefined;

  return {
    store,
    getLastEqValue: () => lastEqValue,
    setLastEqValue: (v: unknown) => {
      lastEqValue = v;
    },
    reset: () => {
      store.length = 0;
      lastEqValue = undefined;
    },
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('drizzle-orm')
  >();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => {
      testState.setLastEqValue(value);
      return actual.eq(column as Parameters<typeof actual.eq>[0], value);
    },
  };
});

vi.mock('@/db', () => {
  const store = testState.store;

  return {
    db: {
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          returning: () => {
            const now = new Date();
            const record = {
              id: crypto.randomUUID(),
              name: v.name as string,
              mimeType: (v.mimeType as string) ?? null,
              size: (v.size as number) ?? 0,
              hasContents: (v.hasContents as boolean) ?? false,
              content: (v.content as Buffer | null) ?? null,
              reference: (v.reference as string | null) ?? null,
              referenceId: (v.referenceId as string | null) ?? null,
              createdAt: now,
              updatedAt: now,
            };
            store.push(record);
            return [record];
          },
        }),
      }),
      select: (fields?: Record<string, unknown>) => {
        const projection = fields;
        return {
          from: () => ({
            where: () => ({
              limit: () => {
                const id = testState.getLastEqValue() as
                  | string
                  | undefined;
                if (id) {
                  const found = store.find((r) => r.id === id);
                  if (!found) return [];
                  // Apply column projection when select has specific fields
                  if (projection && Object.keys(projection).length > 0) {
                    const projected: Record<string, unknown> = {};
                    for (const key of Object.keys(projection)) {
                      projected[key] = (found as Record<string, unknown>)[key];
                    }
                    return [projected];
                  }
                  return [found];
                }
                return [];
              },
            }),
          }),
        };
      },
      delete: () => ({
        where: () => ({
          returning: () => {
            const id = testState.getLastEqValue() as string | undefined;
            if (id) {
              const idx = store.findIndex((r) => r.id === id);
              if (idx >= 0) {
                const removed = store[idx];
                store.splice(idx, 1);
                return [{ id: removed.id }];
              }
            }
            return [];
          },
        }),
      }),
    },
    fileDocuments: {},
  };
});

// ── Module under test ────────────────────────────────────────────────────────

import {
  uploadFile,
  downloadFile,
  getFileInfo,
  deleteFile,
  validateFile,
  FileValidationError,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from './file-document';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('file-document', () => {
  beforeEach(() => {
    testState.reset();
  });

  describe('validateFile', () => {
    it('passes for valid png', () => {
      expect(() =>
        validateFile('photo.png', 'image/png', 1024),
      ).not.toThrow();
    });

    it('passes for valid jpeg', () => {
      expect(() =>
        validateFile('doc.jpg', 'image/jpeg', 512),
      ).not.toThrow();
    });

    it('passes for valid svg', () => {
      expect(() =>
        validateFile('icon.svg', 'image/svg+xml', 2048),
      ).not.toThrow();
    });

    it('passes for valid pdf', () => {
      expect(() =>
        validateFile('report.pdf', 'application/pdf', 5000000),
      ).not.toThrow();
    });

    it('rejects unsupported MIME type', () => {
      expect(() =>
        validateFile('malware.exe', 'application/x-msdownload', 100),
      ).toThrow(FileValidationError);
    });

    it('rejects empty name', () => {
      expect(() =>
        validateFile('', 'image/png', 100),
      ).toThrow(FileValidationError);
    });

    it('rejects name exceeding 400 chars', () => {
      expect(() =>
        validateFile('x'.repeat(401), 'image/png', 100),
      ).toThrow(FileValidationError);
    });

    it('rejects oversize file', () => {
      expect(() =>
        validateFile('big.png', 'image/png', MAX_FILE_SIZE + 1),
      ).toThrow(FileValidationError);
    });

    it('rejects negative size', () => {
      expect(() =>
        validateFile('neg.png', 'image/png', -1),
      ).toThrow(FileValidationError);
    });

    it('is case-insensitive for MIME types', () => {
      expect(() =>
        validateFile('photo.PNG', 'IMAGE/PNG', 100),
      ).not.toThrow();
      expect(() =>
        validateFile('doc.JPG', 'Image/JPEG', 100),
      ).not.toThrow();
    });
  });

  describe('uploadFile + downloadFile round-trip', () => {
    it('stores bytes and retrieves them byte-for-byte', async () => {
      const original = Buffer.from('Hello, bytea world!', 'utf-8');
      const info = await uploadFile('test.txt', 'text/plain', original);

      expect(info.name).toBe('test.txt');
      expect(info.mimeType).toBe('text/plain');
      expect(info.size).toBe(original.length);
      expect(info.hasContents).toBe(true);
      expect(info.id).toBeDefined();

      const downloaded = await downloadFile(info.id);
      expect(downloaded).not.toBeNull();
      expect(downloaded!.content).toBeDefined();
      expect(downloaded!.content!.equals(original)).toBe(true);
      expect(downloaded!.name).toBe('test.txt');
      expect(downloaded!.mimeType).toBe('text/plain');
      expect(downloaded!.size).toBe(original.length);
    });

    it('round-trips binary data (PNG header bytes)', async () => {
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      ]);
      const info = await uploadFile('icon.png', 'image/png', pngHeader);
      const downloaded = await downloadFile(info.id);

      expect(downloaded!.content!.equals(pngHeader)).toBe(true);
    });

    it('round-trips empty buffer', async () => {
      const info = await uploadFile('empty.txt', 'text/plain', Buffer.alloc(0));
      const downloaded = await downloadFile(info.id);

      expect(downloaded!.size).toBe(0);
      expect(downloaded!.content!.length).toBe(0);
    });

    it('downloadFile returns null for missing file', async () => {
      const result = await downloadFile(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toBeNull();
    });
  });

  describe('getFileInfo', () => {
    it('returns metadata without content', async () => {
      const content = Buffer.from('metadata test');
      const info = await uploadFile('meta.txt', 'text/plain', content);
      const meta = await getFileInfo(info.id);

    expect(meta).not.toBeNull();
    expect(meta!.id).toBe(info.id);
    expect(meta!.name).toBe('meta.txt');
    expect(meta!.mimeType).toBe('text/plain');
    expect(meta!.size).toBe(content.length);
    expect(meta!.hasContents).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((meta as any).content).toBeUndefined();
    });

    it('returns null for missing file', async () => {
      const result = await getFileInfo(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('deletes an existing file and returns true', async () => {
      const info = await uploadFile(
        'delete-me.txt',
        'text/plain',
        Buffer.from('bye'),
      );
      const deleted = await deleteFile(info.id);
      expect(deleted).toBe(true);

      const after = await downloadFile(info.id);
      expect(after).toBeNull();
    });

    it('returns false for non-existent file', async () => {
      const result = await deleteFile(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toBe(false);
    });
  });

  describe('upload with options', () => {
    it('stores reference and referenceId', async () => {
      const info = await uploadFile(
        'ref-file.txt',
        'text/plain',
        Buffer.from('ref test'),
        { reference: 'DomainCheckProvider', referenceId: 'prov-123' },
      );

      expect(info.reference).toBe('DomainCheckProvider');
      expect(info.referenceId).toBe('prov-123');

      const downloaded = await downloadFile(info.id);
      expect(downloaded!.reference).toBe('DomainCheckProvider');
      expect(downloaded!.referenceId).toBe('prov-123');
    });
  });

  describe('validation rejection on upload', () => {
    it('rejects unsupported MIME type', async () => {
      await expect(
        uploadFile('virus.exe', 'application/x-msdownload', Buffer.from('bad')),
      ).rejects.toThrow(FileValidationError);
    });

    it('rejects oversize file', async () => {
      const big = Buffer.alloc(MAX_FILE_SIZE + 1);
      await expect(
        uploadFile('big.bin', 'application/octet-stream', big),
      ).rejects.toThrow(FileValidationError);
    });

    it('rejects file with empty name', async () => {
      await expect(
        uploadFile('', 'text/plain', Buffer.from('data')),
      ).rejects.toThrow(FileValidationError);
    });
  });

  describe('ALLOWED_MIME_TYPES and MAX_FILE_SIZE exports', () => {
    it('exports the allowed types list', () => {
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/svg+xml');
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('text/csv');
      expect(ALLOWED_MIME_TYPES).toContain('application/json');
      expect(ALLOWED_MIME_TYPES).toContain('application/xml');
      expect(ALLOWED_MIME_TYPES).toContain('text/plain');
      expect(ALLOWED_MIME_TYPES).toContain('application/octet-stream');
      expect(ALLOWED_MIME_TYPES).toContain('application/pgp-keys');
      expect(ALLOWED_MIME_TYPES).toContain('application/pgp-signature');
      expect(ALLOWED_MIME_TYPES.length).toBe(11);
    });

    it('exports MAX_FILE_SIZE as 10 MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });
  });
});
