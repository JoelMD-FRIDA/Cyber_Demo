import { NextRequest, NextResponse } from 'next/server';
import { downloadFile, getFileInfo, deleteFile } from '@/lib/file-document';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';

// GET /api/files/[id] — Download file content
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const record = await downloadFile(id);
  if (!record || !record.hasContents || !record.content) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const contentType = record.mimeType || 'application/octet-stream';
  const disposition = record.name
    ? `attachment; filename="${encodeURIComponent(record.name)}"`
    : 'attachment';

  return new NextResponse(record.content as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Content-Length': String(record.size),
    },
  });
}

// DELETE /api/files/[id] — Admin-only file deletion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Verify file exists before attempting delete
  const info = await getFileInfo(id);
  if (!info) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  await deleteFile(id);

  return NextResponse.json({ message: 'File deleted' });
}
