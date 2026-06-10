import { NextRequest, NextResponse } from 'next/server';
import { db, forgotPasswordConfigs, emailTemplates } from '@/db';
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

async function getConfig() {
  const configs = await db
    .select()
    .from(forgotPasswordConfigs)
    .limit(1);
  return configs[0] ?? null;
}

async function getTemplateName(id: string | null) {
  if (!id) return null;
  const tmpl = await db
    .select({ name: emailTemplates.name })
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  return tmpl[0] ?? null;
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const config = await getConfig();
  if (!config) {
    return NextResponse.json({ forgotPasswordConfig: null });
  }

  const signupTemplate = config.signupEmailTemplateId
    ? await getTemplateName(config.signupEmailTemplateId)
    : null;
  const resetTemplate = config.resetEmailTemplateId
    ? await getTemplateName(config.resetEmailTemplateId)
    : null;

  return NextResponse.json({
    forgotPasswordConfig: {
      ...config,
      signupTemplate,
      resetTemplate,
    },
  });
}

export async function PUT(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const body = await request.json();
  const { signupEmailTemplateId, resetEmailTemplateId } = body;

  const existing = await getConfig();

  if (existing) {
    const updateData: Record<string, unknown | null> = {};
    if ('signupEmailTemplateId' in body) {
      updateData.signupEmailTemplateId = signupEmailTemplateId || null;
    }
    if ('resetEmailTemplateId' in body) {
      updateData.resetEmailTemplateId = resetEmailTemplateId || null;
    }
    if (Object.keys(updateData).length > 0) {
      await db
        .update(forgotPasswordConfigs)
        .set(updateData)
        .where(eq(forgotPasswordConfigs.id, existing.id));
    }
  } else {
    await db.insert(forgotPasswordConfigs).values({
      signupEmailTemplateId: signupEmailTemplateId || null,
      resetEmailTemplateId: resetEmailTemplateId || null,
    });
  }

  const config = await getConfig();
  const signupTemplate = config?.signupEmailTemplateId
    ? await getTemplateName(config.signupEmailTemplateId)
    : null;
  const resetTemplate = config?.resetEmailTemplateId
    ? await getTemplateName(config.resetEmailTemplateId)
    : null;

  return NextResponse.json({
    forgotPasswordConfig: {
      ...config,
      signupTemplate,
      resetTemplate,
    },
  });
}
