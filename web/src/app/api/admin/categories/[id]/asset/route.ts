import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) throw new ApiError('INVALID_INPUT', 'An image file is required.');
    if (!ALLOWED_TYPES.has(file.type)) throw new ApiError('INVALID_INPUT', 'Only PNG, JPEG, WebP, and SVG files are supported.');
    if (file.size > 2 * 1024 * 1024) throw new ApiError('INVALID_INPUT', 'The image must be smaller than 2 MB.');

    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `categories/${id}.${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from('catalog-assets').upload(path, bytes, { contentType: file.type, upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data: publicUrl } = admin.storage.from('catalog-assets').getPublicUrl(path);
    const { data, error } = await admin.from('domain_check_categories').update({ asset_path: publicUrl.publicUrl }).eq('id', id).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'Category not found.');
    return NextResponse.json({ assetPath: publicUrl.publicUrl });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
