import { requireAdmin } from '@/lib/auth/guards';
import { saveAsset,uploadForm } from '@/server/assets';
import { apiErrorResponse,ApiError } from '@/lib/api-errors';
export async function POST(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  try {
    await requireAdmin();
    const length=Number(request.headers.get('content-length'));
    if (length>3*1024*1024) throw new ApiError('INVALID_INPUT','Upload is too large.');
    const form=await uploadForm(request), file=form.get('file');
    if (!(file instanceof File)) throw new ApiError('INVALID_INPUT','An image is required.');
    return Response.json({ assetPath:await saveAsset(file,'categories',(await params).id) });
  } catch(error) { return apiErrorResponse(error); }
}
