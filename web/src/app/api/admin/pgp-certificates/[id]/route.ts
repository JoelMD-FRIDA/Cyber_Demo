import { NextRequest, NextResponse } from 'next/server';
import { db, pgpCertificates, fileDocuments } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';
import { deleteFile } from '@/lib/file-document';

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

async function findCertificate(id: string) {
  const result = await db
    .select()
    .from(pgpCertificates)
    .where(eq(pgpCertificates.id, id))
    .limit(1);
  return result[0] || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const certificate = await findCertificate(id);

  if (!certificate) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 },
    );
  }

  // Return metadata + download URL for the certificate file
  let fileInfo = null;
  if (certificate.fileDocumentId) {
    const [fileDoc] = await db
      .select({
        id: fileDocuments.id,
        name: fileDocuments.name,
        size: fileDocuments.size,
        hasContents: fileDocuments.hasContents,
        mimeType: fileDocuments.mimeType,
      })
      .from(fileDocuments)
      .where(eq(fileDocuments.id, certificate.fileDocumentId))
      .limit(1);
    if (fileDoc) {
      fileInfo = fileDoc;
    }
  }

  return NextResponse.json({
    certificate: {
      id: certificate.id,
      certificateType: certificate.certificateType,
      reference: certificate.reference,
      emailAddress: certificate.emailAddress,
      fileDocumentId: certificate.fileDocumentId,
      hasCertificateFile: !!fileInfo && fileInfo.hasContents,
      certificateFileName: fileInfo?.name ?? null,
      downloadUrl: fileInfo?.id
        ? `/api/files/${fileInfo.id}`
        : null,
      createdAt: certificate.createdAt,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const certificate = await findCertificate(id);

  if (!certificate) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 },
    );
  }

  // Cascade-delete the associated file document if it exists
  if (certificate.fileDocumentId) {
    await deleteFile(certificate.fileDocumentId);
  }

  await db
    .delete(pgpCertificates)
    .where(eq(pgpCertificates.id, id));

  return NextResponse.json({ message: 'Certificate deleted' });
}
