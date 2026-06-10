import { NextRequest, NextResponse } from 'next/server';
import { db, emailTemplates, emailTemplateLanguages, emailTemplateSmtps, systemLanguages, emailAccounts } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const templates = await db
    .select()
    .from(emailTemplates)
    .orderBy(emailTemplates.createdAt);

  const result = await Promise.all(
    templates.map(async (tmpl) => {
      const languages = await db
        .select({ id: systemLanguages.id, code: systemLanguages.code, description: systemLanguages.description })
        .from(emailTemplateLanguages)
        .innerJoin(systemLanguages, eq(systemLanguages.id, emailTemplateLanguages.languageId))
        .where(eq(emailTemplateLanguages.emailTemplateId, tmpl.id));

      const smtpAccounts = await db
        .select({ id: emailAccounts.id, mailAddress: emailAccounts.mailAddress })
        .from(emailTemplateSmtps)
        .innerJoin(emailAccounts, eq(emailAccounts.id, emailTemplateSmtps.emailAccountId))
        .where(eq(emailTemplateSmtps.emailTemplateId, tmpl.id));

      return { ...tmpl, languages, smtpAccounts };
    }),
  );

  return NextResponse.json({ emailTemplates: result });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const body = await request.json();
  const { name, subject, body: templateBody, fromAddress, fromDisplayName } = body;

  if (!name || !subject || !templateBody) {
    return NextResponse.json(
      { error: 'name, subject, and body are required' },
      { status: 400 },
    );
  }

  const [template] = await db
    .insert(emailTemplates)
    .values({
      name,
      subject,
      body: templateBody,
      fromAddress: fromAddress ?? null,
      fromDisplayName: fromDisplayName ?? null,
    })
    .returning();

  return NextResponse.json({ emailTemplate: template }, { status: 201 });
}
