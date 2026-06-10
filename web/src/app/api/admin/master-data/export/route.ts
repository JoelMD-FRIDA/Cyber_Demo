import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { domainCheckProviders, domainCheckCategories } from "@/db/schema";
import { getSession } from "@/lib/session";
import { Role } from "@/lib/rbac";

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  try {
    const [providers, categories] = await Promise.all([
      db.select().from(domainCheckProviders).orderBy(domainCheckProviders.name),
      db.select().from(domainCheckCategories).orderBy(domainCheckCategories.name),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      providers: providers.map((p) => ({
        uuid: p.uuid,
        name: p.name,
        isActive: p.isActive,
        websiteUrl: p.websiteUrl,
        description: p.description,
        shortDescription: p.shortDescription,
        longDescription: p.longDescription,
        apiBaseUrl: p.apiBaseUrl,
      })),
      categories: categories.map((c) => ({
        uuid: c.uuid,
        name: c.name,
        description: c.description,
      })),
    };

    const body = JSON.stringify(payload, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="master-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Master-data export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
