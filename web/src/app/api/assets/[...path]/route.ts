import { requireUser } from '@/lib/auth/guards';
import { loadAsset } from '@/server/assets';
import { apiErrorResponse } from '@/lib/api-errors';
export async function GET(_request: Request,{ params }: { params:Promise<{ path:string[] }> }) {
  try {
    await requireUser();
    const data = await loadAsset((await params).path);
    return new Response(new Uint8Array(data),{ headers:{ 'Content-Type':'image/png',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; sandbox" } });
  } catch(error) { return apiErrorResponse(error); }
}
