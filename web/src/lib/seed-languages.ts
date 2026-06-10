import { db } from "@/db";
import { systemLanguages } from "@/db/schema";
import { eq } from "drizzle-orm";

const LANGUAGE_SEEDS = [
  {
    code: "de_DE",
    description: "Deutsch (Deutschland) — German (Germany)",
  },
  {
    code: "en_US",
    description: "English (United States)",
  },
];

export async function seedSystemLanguages() {
  const results: { code: string; action: "created" | "skipped" }[] = [];

  for (const lang of LANGUAGE_SEEDS) {
    const existing = await db
      .select()
      .from(systemLanguages)
      .where(eq(systemLanguages.code, lang.code))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(systemLanguages).values({
        code: lang.code,
        description: lang.description,
      });
      results.push({ code: lang.code, action: "created" });
    } else {
      results.push({ code: lang.code, action: "skipped" });
    }
  }

  return results;
}

// Allow running as a standalone script: `npx tsx src/lib/seed-languages.ts`
if (require.main === module) {
  seedSystemLanguages()
    .then((results) => {
      for (const r of results) {
        console.log(`[${r.action.toUpperCase()}] SystemLanguage: ${r.code}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to seed languages:", err);
      process.exit(1);
    });
}
