import { describe, it, expect, vi, beforeEach } from "vitest";
import Handlebars from "handlebars";

const mockSelect = vi.fn();
const mockCreateTransport = vi.fn(() => ({
  sendMail: vi.fn().mockResolvedValue({ messageId: "mock-msg-id" }),
}));

vi.mock("@/db", () => ({
  db: { select: mockSelect },
  emailAccounts: {},
  outgoingEmailConfigs: {},
  emailTemplates: {},
  emailTemplateLanguages: {},
  systemLanguages: {},
  emailTemplateSmtps: {},
}));

vi.mock("@/lib/email-queue", () => ({
  enqueueEmail: vi.fn(async () => "queued-email-id-1"),
}));

vi.mock("@/lib/template", () => ({
  renderTemplate: vi.fn((name: string) => `<p>Mock ${name} template</p>`),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

import { enqueueEmail } from "@/lib/email-queue";

function mockQuery<T>(rows: T[]): Record<string, unknown> & PromiseLike<T[]> {
  const query = {
    then: (resolve: (v: T[]) => void) => { resolve(rows); return Promise.resolve(rows); },
    catch: () => query,
    finally: () => query,
    innerJoin: () => query,
    where: () => query,
    limit: () => query,
    from: () => query,
    orderBy: () => query,
  };
  return query as unknown as Record<string, unknown> & PromiseLike<T[]>;
}

describe("email DB-backed functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDbTemplate", () => {
    it("returns template when found by name without language", async () => {
      mockSelect.mockReturnValue(
        mockQuery([
          { subject: "Test Subject", body: "<p>{{name}}</p>", fromAddress: null, fromDisplayName: null },
        ]),
      );

      const { getDbTemplate } = await import("@/lib/email");
      const result = await getDbTemplate("test-template");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Test Subject");
      expect(result!.body).toBe("<p>{{name}}</p>");
    });

    it("returns null when template not found", async () => {
      mockSelect.mockReturnValue(mockQuery([]));

      const { getDbTemplate } = await import("@/lib/email");
      const result = await getDbTemplate("nonexistent");

      expect(result).toBeNull();
    });

    it("prefers language-specific template when available", async () => {
      mockSelect.mockReturnValue(
        mockQuery([
          { subject: "Deutsch Betreff", body: "<p>Hallo {{name}}</p>", fromAddress: null, fromDisplayName: null },
        ]),
      );

      const { getDbTemplate } = await import("@/lib/email");
      const result = await getDbTemplate("test-template", "de");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Deutsch Betreff");
      expect(result!.body).toBe("<p>Hallo {{name}}</p>");
    });
  });

  describe("sendWithTemplate", () => {
    it("queues email when no SMTP configured", async () => {
      mockSelect
        .mockReturnValueOnce(
          mockQuery([
            { subject: "Welcome", body: "<p>Hi {{username}}</p>", fromAddress: null, fromDisplayName: null },
          ]),
        )
        .mockReturnValueOnce(mockQuery([]));

      const { sendWithTemplate } = await import("@/lib/email");
      const result = await sendWithTemplate("user@test.com", "registration", {
        username: "John",
      });

      expect(result.sent).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.id).toBe("queued-email-id-1");
      expect(enqueueEmail).toHaveBeenCalledWith("user@test.com", "Welcome", "<p>Hi John</p>");
    });

    it("sends immediately when SMTP is configured", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "mock-msg-id" });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      mockSelect
        .mockReturnValueOnce(
          mockQuery([
            { subject: "Welcome", body: "<p>Hi {{username}}</p>", fromAddress: null, fromDisplayName: null },
          ]),
        )
        .mockReturnValueOnce(
          mockQuery([
            {
              host: "smtp.example.com",
              port: 587,
              ssl: false,
              tls: true,
              user: "user@example.com",
              pass: "secret",
              fromAddress: "noreply@example.com",
              fromDisplayName: "Test App",
            },
          ]),
        );

      const { sendWithTemplate } = await import("@/lib/email");
      const result = await sendWithTemplate("user@test.com", "registration", {
        username: "John",
      });

      expect(result.sent).toBe(true);
      expect(result.queued).toBeUndefined();
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@test.com",
          subject: "Welcome",
          html: "<p>Hi John</p>",
        }),
      );
    });
  });

  describe("Handlebars rendering in DB templates", () => {
    it("renders variables in template body", () => {
      const source = "<p>Hi {{username}}, your link: {{confirmationLink}}</p>";
      const template = Handlebars.compile(source);
      const output = template({ username: "John", confirmationLink: "http://example.com/activate/abc" });
      expect(output).toBe('<p>Hi John, your link: http://example.com/activate/abc</p>');
    });

    it("renders variables in template subject", () => {
      const source = "Welcome {{username}}!";
      const template = Handlebars.compile(source);
      const output = template({ username: "John" });
      expect(output).toBe("Welcome John!");
    });

    it("handles missing variables gracefully", () => {
      const source = "Hello {{name}}";
      const template = Handlebars.compile(source);
      const output = template({});
      expect(output).toBe("Hello ");
    });
  });
});
