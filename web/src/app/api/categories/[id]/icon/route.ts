import { NextRequest, NextResponse } from 'next/server';
import { db, domainCheckCategories } from '@/db';
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

  const [category] = await db
    .select()
    .from(domainCheckCategories)
    .where(eq(domainCheckCategories.id, id));

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
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

    const allowedIconMimes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedIconMimes.includes(fileField.type.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported file type '${fileField.type}'. Allowed types: ${allowedIconMimes.join(', ')}` },
        { status: 400 },
      );
    }

    if (fileField.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds maximum of 10 MB' },
        { status: 400 },
      );
    }

    if (category.iconFileDocumentId) {
      await deleteFile(category.iconFileDocumentId).catch(() => {});
    }

    const arrayBuffer = await fileField.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    const fileInfo = await uploadFile(
      fileField.name,
      fileField.type,
      content,
    );

    const [updated] = await db
      .update(domainCheckCategories)
      .set({ iconFileDocumentId: fileInfo.id })
      .where(eq(domainCheckCategories.id, id))
      .returning();

    return NextResponse.json({ category: updated, file: fileInfo }, { status: 200 });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Icon upload error:', error);
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

  const [category] = await db
    .select()
    .from(domainCheckCategories)
    .where(eq(domainCheckCategories.id, id));

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  if (!category.iconFileDocumentId) {
    return NextResponse.json({ error: 'No icon to delete' }, { status: 404 });
  }

  await deleteFile(category.iconFileDocumentId);

  await db
    .update(domainCheckCategories)
    .set({ iconFileDocumentId: null })
    .where(eq(domainCheckCategories.id, id));

  return NextResponse.json({ message: 'Icon deleted' });
}
