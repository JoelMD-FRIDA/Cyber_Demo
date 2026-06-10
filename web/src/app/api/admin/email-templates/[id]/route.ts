import { NextRequest, NextResponse } from 'next/server';
import { db, emailTemplates, emailTemplateLanguages, emailTemplateSmtps, systemLanguages, emailAccounts } from '@/db';
import { eq, and } from 'drizzle-orm';
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

async function getTemplateWithRelations(id: string) {
  const tmpl = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  if (tmpl.length === 0) return null;

  const languages = await db
    .select({ id: systemLanguages.id, code: systemLanguages.code, description: systemLanguages.description })
    .from(emailTemplateLanguages)
    .innerJoin(systemLanguages, eq(systemLanguages.id, emailTemplateLanguages.languageId))
    .where(eq(emailTemplateLanguages.emailTemplateId, id));

  const smtpAccounts = await db
    .select({ id: emailAccounts.id, mailAddress: emailAccounts.mailAddress })
    .from(emailTemplateSmtps)
    .innerJoin(emailAccounts, eq(emailAccounts.id, emailTemplateSmtps.emailAccountId))
    .where(eq(emailTemplateSmtps.emailTemplateId, id));

  return { ...tmpl[0], languages, smtpAccounts };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const template = await getTemplateWithRelations(id);
  if (!template) {
    return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
  }
  return NextResponse.json({ emailTemplate: template });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const existing = await getTemplateWithRelations(id);
  if (!existing) {
    return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if ('name' in body) updateData.name = body.name;
  if ('subject' in body) updateData.subject = body.subject;
  if ('body' in body) updateData.body = body.body;
  if ('fromAddress' in body) updateData.fromAddress = body.fromAddress;
  if ('fromDisplayName' in body) updateData.fromDisplayName = body.fromDisplayName;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(emailTemplates)
      .set(updateData)
      .where(eq(emailTemplates.id, id));
  }

  if ('languageIds' in body) {
    await db
      .delete(emailTemplateLanguages)
      .where(eq(emailTemplateLanguages.emailTemplateId, id));
    if (Array.isArray(body.languageIds) && body.languageIds.length > 0) {
      await db.insert(emailTemplateLanguages).values(
        body.languageIds.map((langId: string) => ({
          emailTemplateId: id,
          languageId: langId,
        })),
      );
    }
  }

  if ('smtpAccountIds' in body) {
    await db
      .delete(emailTemplateSmtps)
      .where(eq(emailTemplateSmtps.emailTemplateId, id));
    if (Array.isArray(body.smtpAccountIds) && body.smtpAccountIds.length > 0) {
      await db.insert(emailTemplateSmtps).values(
        body.smtpAccountIds.map((acctId: string) => ({
          emailTemplateId: id,
          emailAccountId: acctId,
        })),
      );
    }
  }

  const updated = await getTemplateWithRelations(id);
  return NextResponse.json({ emailTemplate: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const existing = await getTemplateWithRelations(id);
  if (!existing) {
    return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
  }

  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  return NextResponse.json({ message: 'Email template deleted' });
}
