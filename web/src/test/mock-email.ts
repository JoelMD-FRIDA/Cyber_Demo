// ── In-Memory Email Mock ──────────────────────────────────────────────────────
//
// In-memory queue that tracks sent emails without touching a real SMTP server.
// Provides fixture switches for SMTP, OAuth, LDAP, and incoming-email contexts.
//
// Usage (Vitest):
//   import { mockEmailModule } from '@/test/mock-email';
//   mockEmailModule();
//   // ... code that sends email ...
//   const sent = mockEmailQueue.getSentEmails();
//   expect(sent).toHaveLength(1);
//   expect(sent[0].to).toBe('user@example.com');
//
// ──────────────────────────────────────────────────────────────────────────────

import { vi } from "vitest";

// ── In-Memory Email Queue ─────────────────────────────────────────────────────

export interface MockSentEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  sentAt: Date;
  error?: string;
}

class MockEmailQueue {
  private sent: MockSentEmail[] = [];
  private failNext = false;
  private failError = new Error("Simulated email send failure");

  send(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }): MockSentEmail {
    if (this.failNext) {
      this.failNext = false;
      throw this.failError;
    }
    const email: MockSentEmail = {
      id: `mock-email-${this.sent.length + 1}`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      from: options.from,
      sentAt: new Date(),
    };
    this.sent.push(email);
    return email;
  }

  getSentEmails(): MockSentEmail[] {
    return [...this.sent];
  }

  clear(): void {
    this.sent = [];
    this.failNext = false;
  }

  getCount(): number {
    return this.sent.length;
  }

  /** Make the next send() call throw an error. */
  simulateFailure(error?: string): void {
    this.failNext = true;
    if (error) {
      this.failError = new Error(error);
    }
  }
}

export const mockEmailQueue = new MockEmailQueue();

// ── Fixture Switches ──────────────────────────────────────────────────────────
//
// These flags mimic production configuration states without real credentials.
// Use them to test how the app behaves when each integration is toggled.

export interface EmailFixtureSwitches {
  /** True = SMTP is configured and active */
  smtpEnabled: boolean;
  /** True = OAuth is configured for email sending */
  oauthEnabled: boolean;
  /** True = LDAP directory is configured */
  ldapEnabled: boolean;
  /** True = incoming email (IMAP/POP3) is configured */
  incomingEmailEnabled: boolean;
}

export const defaultFixtureSwitches: EmailFixtureSwitches = {
  smtpEnabled: true,
  oauthEnabled: false,
  ldapEnabled: false,
  incomingEmailEnabled: false,
};

export function createEmailFixtureSwitches(
  overrides?: Partial<EmailFixtureSwitches>,
): EmailFixtureSwitches {
  return { ...defaultFixtureSwitches, ...overrides };
}

// ── Module Mock Factory (Vitest) ──────────────────────────────────────────────
//
// Import this in your test file at the TOP LEVEL and pass to vi.mock():
//
//   import { createEmailMockModule } from '@/test/mock-email';
//   vi.mock('@/lib/email', () => createEmailMockModule());
//
// vi.mock is hoisted to the top of the file by Vitest, so this must never
// be called conditionally or inside a function.

export function createEmailMockModule() {
  return {
    sendEmail: vi.fn(
      async (to: string, subject: string, html: string, text?: string) => {
        return mockEmailQueue.send({ to, subject, html, text });
      },
    ),
    sendEmailWithTemplate: vi.fn(
      async (
        to: string,
        _templateName: string,
        _variables: Record<string, unknown>,
        subject?: string,
      ) => {
        return mockEmailQueue.send({
          to,
          subject: subject ?? "Template Email",
          html: "<p>Mock template email</p>",
        });
      },
    ),
    createTransporter: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  };
}

export type EmailMockModule = ReturnType<typeof createEmailMockModule>;
