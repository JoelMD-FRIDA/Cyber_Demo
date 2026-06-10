import { describe, it, expect, beforeEach } from "vitest";
import {
  mockEmailQueue,
  createEmailFixtureSwitches,
  defaultFixtureSwitches,
} from "./mock-email";

describe("mock-email", () => {
  describe("mockEmailQueue", () => {
    beforeEach(() => {
      mockEmailQueue.clear();
    });

    it("sends and records an email", () => {
      const result = mockEmailQueue.send({
        to: "user@test.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.to).toBe("user@test.com");
      expect(result.subject).toBe("Test");
      expect(result.id).toBe("mock-email-1");

      const sent = mockEmailQueue.getSentEmails();
      expect(sent).toHaveLength(1);
    });

    it("tracks multiple sent emails", () => {
      mockEmailQueue.send({ to: "a@test.com", subject: "S1", html: "<p>A</p>" });
      mockEmailQueue.send({ to: "b@test.com", subject: "S2", html: "<p>B</p>" });

      expect(mockEmailQueue.getCount()).toBe(2);
      expect(mockEmailQueue.getSentEmails()[1].subject).toBe("S2");
    });

    it("supports simulateFailure", () => {
      mockEmailQueue.simulateFailure("SMTP connection refused");
      expect(() => {
        mockEmailQueue.send({ to: "x@test.com", subject: "Fail", html: "<p>X</p>" });
      }).toThrow("SMTP connection refused");
      // After the failure, the flag resets
      expect(() => {
        mockEmailQueue.send({ to: "y@test.com", subject: "Ok", html: "<p>Y</p>" });
      }).not.toThrow();
    });

    it("clears queue", () => {
      mockEmailQueue.send({ to: "a@test.com", subject: "S1", html: "<p>A</p>" });
      mockEmailQueue.clear();
      expect(mockEmailQueue.getCount()).toBe(0);
    });

    it("stores optional from and text fields", () => {
      const result = mockEmailQueue.send({
        to: "user@test.com",
        subject: "Test",
        html: "<p>HTML</p>",
        text: "Plain text",
        from: "sender@test.com",
      });
      expect(result.text).toBe("Plain text");
      expect(result.from).toBe("sender@test.com");
    });
  });

  describe("createEmailFixtureSwitches", () => {
    it("returns defaults when no overrides", () => {
      const sw = createEmailFixtureSwitches();
      expect(sw).toEqual(defaultFixtureSwitches);
    });

    it("allows partial overrides", () => {
      const sw = createEmailFixtureSwitches({ smtpEnabled: false });
      expect(sw.smtpEnabled).toBe(false);
      expect(sw.oauthEnabled).toBe(false); // unchanged
    });
  });
});
