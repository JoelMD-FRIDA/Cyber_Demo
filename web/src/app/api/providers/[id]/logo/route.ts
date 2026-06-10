import { NextRequest, NextResponse } from 'next/server';
import { db, domainCheckProviders } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';
import { uploadFile, deleteFile, FileValidationError } from '@/lib/file-document';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, id));

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const fileField = formData.get('file');

    if (!fileField || !(fileField instanceof File)) {
      return NextResponse.json(
        { error: 'A file is required (multipart field name: "file")' },
        { status: 400 },
      );
    }

    const allowedLogoMimes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedLogoMimes.includes(fileField.type.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported file type '${fileField.type}'. Allowed types: ${allowedLogoMimes.join(', ')}` },
        { status: 400 },
      );
    }

    if (fileField.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds maximum of 10 MB' },
        { status: 400 },
      );
    }

    if (provider.logoFileDocumentId) {
      await deleteFile(provider.logoFileDocumentId).catch(() => {});
    }

    const arrayBuffer = await fileField.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    const fileInfo = await uploadFile(
      fileField.name,
      fileField.type,
      content,
    );

    const [updated] = await db
      .update(domainCheckProviders)
      .set({ logoFileDocumentId: fileInfo.id })
      .where(eq(domainCheckProviders.id, id))
      .returning();

    return NextResponse.json({ provider: updated, file: fileInfo }, { status: 200 });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Logo upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, id));

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  if (!provider.logoFileDocumentId) {
    return NextResponse.json({ error: 'No logo to delete' }, { status: 404 });
  }

  await deleteFile(provider.logoFileDocumentId);

  await db
    .update(domainCheckProviders)
    .set({ logoFileDocumentId: null })
    .where(eq(domainCheckProviders.id, id));

  return NextResponse.json({ message: 'Logo deleted' });
}
