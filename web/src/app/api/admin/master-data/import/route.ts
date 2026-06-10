import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  domainCheckProviders,
  domainCheckCategories,
  masterDataImportExport,
} from "@/db/schema";
import { uploadFile, FileValidationError } from "@/lib/file-document";
import { getSession } from "@/lib/session";
import { Role } from "@/lib/rbac";
import { eq } from "drizzle-orm";

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

type ImportRow = {
  type: "provider" | "category";
  uuid?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  websiteUrl?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  apiBaseUrl?: string | null;
};

type ImportReport = {
  imported: number;
  updated: number;
  errors: { row: number; reason: string }[];
  skipped: number;
  providersImported: number;
  providersUpdated: number;
  categoriesImported: number;
  categoriesUpdated: number;
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim().toLowerCase()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        values.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  values.push(current);
  return values;
}

function parseJSON(text: string): ImportRow[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON payload must be an array of objects");
  }
  return parsed as ImportRow[];
}

function normalizeRows(rawRows: Record<string, string>[] | ImportRow[], format: "csv" | "json"): ImportRow[] {
  if (format === "json") {
    return rawRows as ImportRow[];
  }

  const rows: ImportRow[] = [];
  for (const raw of rawRows as Record<string, string>[]) {
    const type = (raw.type || "").toLowerCase().trim();
    if (type !== "provider" && type !== "category") {
      continue;
    }

    const row: ImportRow = {
      type: type as "provider" | "category",
      name: raw.name || "",
    };

    if (raw.uuid) row.uuid = raw.uuid;
    if (raw.description) row.description = raw.description;
    if (raw.isactive !== undefined) row.isActive = raw.isactive === "true" || raw.isactive === "1";
    if (raw.websiteurl) row.websiteUrl = raw.websiteurl;
    if (raw.shortdescription) row.shortDescription = raw.shortdescription;
    if (raw.longdescription) row.longDescription = raw.longdescription;
    if (raw.apibaseurl) row.apiBaseUrl = raw.apibaseurl;

    rows.push(row);
  }

  return rows;
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  try {
    const formData = await request.formData();
    const fileField = formData.get("file");

    if (!fileField || !(fileField instanceof File)) {
      return NextResponse.json(
        { error: 'A file is required (multipart field name: "file")' },
        { status: 400 },
      );
    }

    const arrayBuffer = await fileField.arrayBuffer();
    const content = Buffer.from(arrayBuffer);
    const fileName = fileField.name.toLowerCase();

    const fileInfo = await uploadFile(fileField.name, fileField.type, content, {
      reference: "master-data-import",
    });

    const [importJob] = await db
      .insert(masterDataImportExport)
      .values({
        fileDocumentId: fileInfo.id,
        importType: "master-data",
        status: "processing",
      })
      .returning();

    let rows: ImportRow[];
    if (fileName.endsWith(".json")) {
      const text = content.toString("utf-8");
      const parsed = parseJSON(text);
      rows = normalizeRows(parsed, "json");
    } else if (fileName.endsWith(".csv")) {
      const text = content.toString("utf-8");
      const parsed = parseCSV(text);
      rows = normalizeRows(parsed, "csv");
    } else {
      await db
        .update(masterDataImportExport)
        .set({ status: "failed" })
        .where(eq(masterDataImportExport.id, importJob.id));

      return NextResponse.json(
        { error: "Unsupported file format. Use .json or .csv" },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      await db
        .update(masterDataImportExport)
        .set({ status: "completed" })
        .where(eq(masterDataImportExport.id, importJob.id));

      return NextResponse.json({
        imported: 0,
        updated: 0,
        errors: [],
        skipped: 0,
        note: "No valid rows found in the file.",
      });
    }

    const report: ImportReport = {
      imported: 0,
      updated: 0,
      errors: [],
      skipped: 0,
      providersImported: 0,
      providersUpdated: 0,
      categoriesImported: 0,
      categoriesUpdated: 0,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        if (!row.name || row.name.trim().length === 0) {
          report.errors.push({ row: i + 1, reason: "Missing required field: name" });
          report.skipped++;
          continue;
        }

        if (row.type === "provider") {
          const providerUuid = row.uuid || crypto.randomUUID();
          const existing = await db
            .select({ id: domainCheckProviders.id })
            .from(domainCheckProviders)
            .where(eq(domainCheckProviders.uuid, providerUuid))
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(domainCheckProviders)
              .set({
                name: row.name,
                isActive: row.isActive ?? true,
                websiteUrl: row.websiteUrl ?? null,
                description: row.description ?? null,
                shortDescription: row.shortDescription ?? null,
                longDescription: row.longDescription ?? null,
                apiBaseUrl: row.apiBaseUrl ?? null,
              })
              .where(eq(domainCheckProviders.uuid, providerUuid));
            report.updated++;
            report.providersUpdated++;
          } else {
            await db.insert(domainCheckProviders).values({
              uuid: providerUuid,
              name: row.name,
              isActive: row.isActive ?? true,
              websiteUrl: row.websiteUrl ?? null,
              description: row.description ?? null,
              shortDescription: row.shortDescription ?? null,
              longDescription: row.longDescription ?? null,
              apiBaseUrl: row.apiBaseUrl ?? null,
            });
            report.imported++;
            report.providersImported++;
          }
        } else if (row.type === "category") {
          const categoryUuid = row.uuid || crypto.randomUUID();
          const existing = await db
            .select({ id: domainCheckCategories.id })
            .from(domainCheckCategories)
            .where(eq(domainCheckCategories.uuid, categoryUuid))
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(domainCheckCategories)
              .set({
                name: row.name,
                description: row.description ?? null,
              })
              .where(eq(domainCheckCategories.uuid, categoryUuid));
            report.updated++;
            report.categoriesUpdated++;
          } else {
            await db.insert(domainCheckCategories).values({
              uuid: categoryUuid,
              name: row.name,
              description: row.description ?? null,
            });
            report.imported++;
            report.categoriesImported++;
          }
        } else {
          report.errors.push({ row: i + 1, reason: `Unknown type: ${row.type}. Must be "provider" or "category".` });
          report.skipped++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        report.errors.push({ row: i + 1, reason: message });
        report.skipped++;
      }
    }

    const finalStatus = report.errors.length > 0 ? "completed_with_errors" : "completed";
    await db
      .update(masterDataImportExport)
      .set({ status: finalStatus })
      .where(eq(masterDataImportExport.id, importJob.id));

    return NextResponse.json({
      ...report,
      importJobId: importJob.id,
      fileDocumentId: fileInfo.id,
    });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON format in uploaded file." },
        { status: 400 },
      );
    }
    console.error("Master-data import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
