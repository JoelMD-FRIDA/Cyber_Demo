import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, FileValidationError } from '@/lib/file-document';

// POST /api/files — Upload a file (multipart/form-data)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileField = formData.get('file');

    if (!fileField || !(fileField instanceof File)) {
      return NextResponse.json(
        { error: 'A file is required (multipart field name: "file")' },
        { status: 400 },
      );
    }

    const reference = (formData.get('reference') as string) || undefined;
    const referenceId = (formData.get('referenceId') as string) || undefined;

    // Convert the File to a Buffer
    const arrayBuffer = await fileField.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    const info = await uploadFile(fileField.name, fileField.type, content, {
      reference,
      referenceId,
    });

    return NextResponse.json({ file: info }, { status: 201 });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
