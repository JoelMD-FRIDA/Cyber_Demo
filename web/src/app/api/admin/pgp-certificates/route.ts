import { NextRequest, NextResponse } from 'next/server';
import { db, pgpCertificates, fileDocuments } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';
import { importCertificate } from '@/lib/pgp';
import { uploadFile } from '@/lib/file-document';

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const certificates = await db
    .select({
      id: pgpCertificates.id,
      certificateType: pgpCertificates.certificateType,
      reference: pgpCertificates.reference,
      emailAddress: pgpCertificates.emailAddress,
      fileDocumentId: pgpCertificates.fileDocumentId,
      createdAt: pgpCertificates.createdAt,
    })
    .from(pgpCertificates)
    .orderBy(desc(pgpCertificates.createdAt));

  // Enrich with file info from file_documents
  const enriched = await Promise.all(
    certificates.map(async (cert) => {
      let fileInfo = null;
      if (cert.fileDocumentId) {
        const [fileDoc] = await db
          .select({
            id: fileDocuments.id,
            name: fileDocuments.name,
            size: fileDocuments.size,
            hasContents: fileDocuments.hasContents,
            mimeType: fileDocuments.mimeType,
          })
          .from(fileDocuments)
          .where(eq(fileDocuments.id, cert.fileDocumentId))
          .limit(1);
        if (fileDoc) {
          fileInfo = {
            id: fileDoc.id,
            name: fileDoc.name,
            size: fileDoc.size,
            hasContents: fileDoc.hasContents,
            mimeType: fileDoc.mimeType,
          };
        }
      }
      return {
        id: cert.id,
        certificateType: cert.certificateType,
        reference: cert.reference,
        emailAddress: cert.emailAddress,
        fileDocumentId: cert.fileDocumentId,
        hasCertificateFile: !!fileInfo && fileInfo.hasContents,
        certificateFileName: fileInfo?.name ?? null,
        createdAt: cert.createdAt,
      };
    }),
  );

  return NextResponse.json({ certificates: enriched });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const emailAddress = formData.get('emailAddress') as string | null;

  if (!file) {
    return NextResponse.json(
      { error: 'Certificate file is required' },
      { status: 400 },
    );
  }

  // Read the file content (armored key text) as a Buffer
  const arrayBuffer = await file.arrayBuffer();
  const keyBuffer = Buffer.from(arrayBuffer);
  const armoredKey = keyBuffer.toString('utf-8');

  let metadata;
  try {
    metadata = await importCertificate(armoredKey);
  } catch {
    return NextResponse.json(
      { error: 'Invalid armored key format' },
      { status: 400 },
    );
  }

  // Store certificate key file bytes in file_documents (bytea column)
  const fileDoc = await uploadFile(
    file.name || 'pgp-certificate.asc',
    'application/pgp-keys',
    keyBuffer,
  );

  const certificateType = metadata.isPrivate ? 'private' : 'public';

  const [certificate] = await db
    .insert(pgpCertificates)
    .values({
      certificateType,
      fileDocumentId: fileDoc.id,
      reference: metadata.fingerprint,
      emailAddress: emailAddress || metadata.userIds[0] || null,
    })
    .returning();

  return NextResponse.json(
    {
      certificate: {
        id: certificate.id,
        certificateType: certificate.certificateType,
        reference: certificate.reference,
        emailAddress: certificate.emailAddress,
        fileDocumentId: certificate.fileDocumentId,
        hasCertificateFile: true,
        certificateFileName: fileDoc.name,
        createdAt: certificate.createdAt,
      },
    },
    { status: 201 },
  );
}
