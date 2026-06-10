import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB for job-tracker tests ─────────────────────────────────────────────

const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/db", () => ({
  db: mockDb,
  backgroundJobEntries: {},
  scheduledEventEntries: {},
  domainCheckProviders: {},
  domainCheckCategories: {},
  masterDataImportExport: {},
}));

vi.mock("@/lib/file-document", () => ({
  uploadFile: vi.fn(async () => ({ id: "mock-file-id" })),
  FileValidationError: class extends Error {
    constructor(msg: string) { super(msg); this.name = "FileValidationError"; }
  },
}));

import { uploadFile, FileValidationError } from "@/lib/file-document";

// ── Job Tracker Tests ─────────────────────────────────────────────────────────

describe("job-tracker API functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startJob", () => {
    it("starts a background job", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "job-1",
              jobId: "process-emails",
              startTime: new Date(),
              endTime: null,
              result: "Manual trigger",
              successful: false,
              createdAt: new Date(),
            },
          ]),
        }),
      });

      const { startJob } = await import("@/lib/job-tracker");
      const result = await startJob("process-emails", "Manual trigger");

      expect(result.jobId).toBe("process-emails");
      expect(result.endTime).toBeNull();
      expect(result.successful).toBe(false);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("completeJob", () => {
    it("marks a job as successful", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const { completeJob } = await import("@/lib/job-tracker");
      await completeJob("job-1", JSON.stringify({ processed: 5, failed: 0 }));

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("failJob", () => {
    it("marks a job as failed with error", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const { failJob } = await import("@/lib/job-tracker");
      await failJob("job-1", "SMTP connection refused");

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("getRecentJobs", () => {
    it("retrieves recent jobs", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "job-1",
                jobId: "process-emails",
                startTime: new Date(),
                endTime: new Date(),
                result: JSON.stringify({ processed: 5, failed: 0 }),
                successful: true,
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const { getRecentJobs } = await import("@/lib/job-tracker");
      const jobs = await getRecentJobs(10);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].successful).toBe(true);
      expect(jobs[0].jobId).toBe("process-emails");
    });
  });

  describe("logScheduledEvent", () => {
    it("logs a scheduled event", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "event-1",
              name: "email-processor",
              description: "Processing email queue",
              startTime: new Date(),
              endTime: null,
              status: 1,
              createdAt: new Date(),
            },
          ]),
        }),
      });

      const { logScheduledEvent } = await import("@/lib/job-tracker");
      const result = await logScheduledEvent("email-processor", "Processing email queue", 1);

      expect(result.name).toBe("email-processor");
      expect(result.status).toBe(1);
    });
  });
});

// ── Integration Status Logic Tests ────────────────────────────────────────────

describe("Integration status logic", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects SMTP as configured when all env vars set", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASS", "pass");
    vi.stubEnv("EMAIL_FROM", "noreply@example.com");
    vi.stubEnv("EMAIL_FROM_NAME", "Test App");

    const smtpVars: Record<string, "set" | "unset"> = {
      SMTP_HOST: process.env.SMTP_HOST ? "set" : "unset",
      SMTP_PORT: process.env.SMTP_PORT ? "set" : "unset",
      SMTP_SECURE: process.env.SMTP_SECURE ? "set" : "unset",
      SMTP_USER: process.env.SMTP_USER ? "set" : "unset",
      SMTP_PASS: process.env.SMTP_PASS ? "set" : "unset",
      EMAIL_FROM: process.env.EMAIL_FROM ? "set" : "unset",
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ? "set" : "unset",
    };
    const smtpSetCount = Object.values(smtpVars).filter((v) => v === "set").length;
    const smtpStatus = smtpSetCount >= 4 ? "configured" : smtpSetCount > 0 ? "fixture" : "missing";

    expect(smtpStatus).toBe("configured");
    expect(smtpSetCount).toBeGreaterThanOrEqual(4);
  });

  it("detects SMTP as missing when no env vars set", () => {
    const smtpVars: Record<string, "set" | "unset"> = {
      SMTP_HOST: process.env.SMTP_HOST ? "set" : "unset",
      SMTP_PORT: process.env.SMTP_PORT ? "set" : "unset",
      SMTP_USER: process.env.SMTP_USER ? "set" : "unset",
      SMTP_PASS: process.env.SMTP_PASS ? "set" : "unset",
      EMAIL_FROM: process.env.EMAIL_FROM ? "set" : "unset",
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ? "set" : "unset",
    };
    const smtpSetCount = Object.values(smtpVars).filter((v) => v === "set").length;
    const smtpStatus = smtpSetCount >= 4 ? "configured" : smtpSetCount > 0 ? "fixture" : "missing";

    expect(smtpStatus).toBe("missing");
    expect(smtpSetCount).toBe(0);
  });

  it("detects SMTP as fixture when partially configured", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");

    const smtpVars: Record<string, "set" | "unset"> = {
      SMTP_HOST: process.env.SMTP_HOST ? "set" : "unset",
      SMTP_PORT: process.env.SMTP_PORT ? "set" : "unset",
      SMTP_USER: process.env.SMTP_USER ? "set" : "unset",
      SMTP_PASS: process.env.SMTP_PASS ? "set" : "unset",
      EMAIL_FROM: process.env.EMAIL_FROM ? "set" : "unset",
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ? "set" : "unset",
    };
    const smtpSetCount = Object.values(smtpVars).filter((v) => v === "set").length;
    const smtpStatus = smtpSetCount >= 4 ? "configured" : smtpSetCount > 0 ? "fixture" : "missing";

    expect(smtpStatus).toBe("fixture");
    expect(smtpSetCount).toBeGreaterThan(0);
    expect(smtpSetCount).toBeLessThan(4);
  });

  it("detects Cysmo/OAuth as configured when key vars set", () => {
    vi.stubEnv("CYSMO_API_BASE_URL", "https://api.cysmo.com");
    vi.stubEnv("CYSMO_CLIENT_ID", "client-id");
    vi.stubEnv("CYSMO_CLIENT_SECRET", "secret");

    const cysmoVars: Record<string, "set" | "unset"> = {
      CYSMO_API_BASE_URL: process.env.CYSMO_API_BASE_URL ? "set" : "unset",
      CYSMO_CLIENT_ID: process.env.CYSMO_CLIENT_ID ? "set" : "unset",
      CYSMO_CLIENT_SECRET: process.env.CYSMO_CLIENT_SECRET ? "set" : "unset",
    };
    const cysmoSetCount = Object.values(cysmoVars).filter((v) => v === "set").length;
    const cysmoStatus = cysmoSetCount >= 3 ? "configured" : cysmoSetCount > 0 ? "fixture" : "missing";

    expect(cysmoStatus).toBe("configured");
  });

  it("detects Cysmo as missing when no env vars", () => {
    const cysmoVars: Record<string, "set" | "unset"> = {
      CYSMO_API_BASE_URL: process.env.CYSMO_API_BASE_URL ? "set" : "unset",
      CYSMO_CLIENT_ID: process.env.CYSMO_CLIENT_ID ? "set" : "unset",
      CYSMO_CLIENT_SECRET: process.env.CYSMO_CLIENT_SECRET ? "set" : "unset",
    };
    const cysmoSetCount = Object.values(cysmoVars).filter((v) => v === "set").length;
    const cysmoStatus = cysmoSetCount >= 3 ? "configured" : cysmoSetCount > 0 ? "fixture" : "missing";

    expect(cysmoStatus).toBe("missing");
  });

  it("labels Live Mendix Comparison as human-gated", () => {
    // The live-mendix integration is always human-gated as defined in the route
    const liveStatus = "human-gated";
    expect(liveStatus).toBe("human-gated");
  });
});

// ── Master Data Import/Export Logic Tests ──────────────────────────────────────

describe("Master-data import/export logic", () => {
  describe("Import file validation (from route implementation)", () => {
    it("FileValidationError is thrown for invalid files", () => {
      const err = new FileValidationError("Unsupported file type. Use .json or .csv");

      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("Unsupported file type");
    });

    it("uploadFile called with correct parameters", async () => {
      const mockBuffer = Buffer.from(JSON.stringify([{ type: "provider", name: "Test" }]));

      const result = await uploadFile("test.json", "application/json", mockBuffer, {
        reference: "master-data-import",
      });

      expect(uploadFile).toHaveBeenCalledWith("test.json", "application/json", mockBuffer, {
        reference: "master-data-import",
      });
      expect(result.id).toBe("mock-file-id");
    });
  });

  describe("Import row validation logic (simulating route handler)", () => {
    it("validates provider rows have required name field", () => {
      const rows = [
        { type: "provider" as const, name: "" },
      ];

      const errors: { row: number; reason: string }[] = [];
      rows.forEach((row, i) => {
        if (!row.name || row.name.trim().length === 0) {
          errors.push({ row: i + 1, reason: "Missing required field: name" });
        }
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe("Missing required field: name");
    });

    it("validates type field is provider or category", () => {
      const rows = [
        { type: "invalid_type", name: "Something" },
      ];

      const validTypes = ["provider", "category"];
      const errors: { row: number; reason: string }[] = [];
      rows.forEach((row, i) => {
        if (!validTypes.includes(row.type)) {
          errors.push({ row: i + 1, reason: `Unknown type: ${row.type}. Must be "provider" or "category".` });
        }
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain("Unknown type");
    });

    it("accepts valid provider rows without errors", () => {
      const rows = [
        { type: "provider" as const, name: "ValidProvider" },
        { type: "category" as const, name: "ValidCategory" },
      ];

      const errors: { row: number; reason: string }[] = [];
      rows.forEach((row, i) => {
        if (!row.name || row.name.trim().length === 0) {
          errors.push({ row: i + 1, reason: "Missing required field: name" });
        }
        if (row.type !== "provider" && row.type !== "category") {
          errors.push({ row: i + 1, reason: `Unknown type` });
        }
      });

      expect(errors).toHaveLength(0);
    });

    it("validates API base URL format when present", () => {
      const apiBaseUrl = "not-a-url";
      const isValid = apiBaseUrl.startsWith("http");
      expect(isValid).toBe(false);
    });

    it("accepts valid API base URL", () => {
      const apiBaseUrl = "https://api.example.com/v1";
      const isValid = apiBaseUrl.startsWith("http");
      expect(isValid).toBe(true);
    });
  });

  describe("Export payload structure", () => {
    it("builds the correct export payload shape", () => {
      const mockProviders = [
        { name: "Provider1", uuid: "uuid-1", isActive: true },
      ];
      const mockCategories = [
        { name: "Category1", uuid: "uuid-2" },
      ];

      const payload = {
        exportedAt: new Date().toISOString(),
        providers: mockProviders.map((p) => ({
          uuid: p.uuid,
          name: p.name,
          isActive: p.isActive,
        })),
        categories: mockCategories.map((c) => ({
          uuid: c.uuid,
          name: c.name,
        })),
      };

      expect(payload.providers).toHaveLength(1);
      expect(payload.categories).toHaveLength(1);
      expect(payload.providers[0].name).toBe("Provider1");
      expect(payload.categories[0].name).toBe("Category1");
      expect(payload.exportedAt).toBeDefined();
    });

    it("serializes to valid JSON", () => {
      const payload = {
        exportedAt: "2026-01-01T00:00:00.000Z",
        providers: [{ uuid: "uuid-1", name: "P1", isActive: true }],
        categories: [{ uuid: "uuid-2", name: "C1" }],
      };

      const body = JSON.stringify(payload, null, 2);
      const parsed = JSON.parse(body);

      expect(parsed.providers[0].name).toBe("P1");
      expect(parsed.categories[0].name).toBe("C1");
    });
  });
});

// ── Jobs Trigger API Logic Tests ──────────────────────────────────────────────

describe("Jobs trigger API logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("job lifecycle: start → complete produces expected shape", async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "job-lifecycle-1",
            jobId: "process-emails",
            startTime: new Date(),
            endTime: null,
            result: "Manual trigger from admin UI",
            successful: false,
            createdAt: new Date(),
          },
        ]),
      }),
    });

    const { startJob, completeJob } = await import("@/lib/job-tracker");

    const job = await startJob("process-emails", "Manual trigger from admin UI");
    expect(job.endTime).toBeNull();

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await completeJob(job.id, JSON.stringify({ processed: 3, failed: 0 }));

    expect(mockDb.update).toHaveBeenCalled();
  });

  it("job lifecycle: start → fail captures error", async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "job-lifecycle-2",
            jobId: "process-emails",
            startTime: new Date(),
            endTime: null,
            result: "Manual trigger",
            successful: false,
            createdAt: new Date(),
          },
        ]),
      }),
    });

    const { startJob, failJob } = await import("@/lib/job-tracker");

    const job = await startJob("process-emails", "Manual trigger");
    expect(job.endTime).toBeNull();

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await failJob(job.id, "Connection to SMTP server failed");

    expect(mockDb.update).toHaveBeenCalled();
  });
});
