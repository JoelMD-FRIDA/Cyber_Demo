import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

async function seedAdmin() {
  const email = "admin@example.com";
  const password = "Test1234!";

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[SKIPPED] Admin user already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    email,
    username: "admin",
    firstname: "Admin",
    lastname: "User",
    role: "admin",
    passwordHash,
    isActivated: true,
    company: "Cyber",
  });

  console.log(`[CREATED] Admin user: ${email} / ${password}`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin user:", err);
  process.exit(1);
});
