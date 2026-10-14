export const dynamic = 'force-dynamic';

export async function GET() {
  // This revision still uses Supabase. It cannot serve the selected PostgreSQL
  // architecture or central login. Do not admit it by probing a static/login page
  // or toggling an environment flag. Replace this refusal with tested, bounded
  // DB/schema/assets/session checks alongside the actual application migration.
  return Response.json({ status: 'unavailable' }, {
    status: 503, headers: { 'Cache-Control': 'no-store' },
  });
}
