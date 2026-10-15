export async function POST() { return Response.json({ error:'Use central sign-in.',code:'FORBIDDEN' },{ status:410 }); }
