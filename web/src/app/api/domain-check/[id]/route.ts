import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getDomainCheck, advanceDomainCheck } from '@/server/domain-check-service';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Params) {
  try { return NextResponse.json({ check:await getDomainCheck((await params).id) },{ headers:{ 'Cache-Control':'private, no-store' } }); }
  catch(error) { return apiErrorResponse(error); }
}
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ check:await advanceDomainCheck(id) },{ headers:{ 'Cache-Control':'private, no-store' } });
  } catch(error) { return apiErrorResponse(error); }
}
