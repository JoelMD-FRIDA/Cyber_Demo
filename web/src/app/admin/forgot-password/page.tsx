"use client"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2Icon, SaveIcon } from "lucide-react";

type ForgotPasswordConfig = {
  id: string;
  signupEmailTemplateId: string | null;
  resetEmailTemplateId: string | null;
  signupTemplate: { name: string } | null;
  resetTemplate: { name: string } | null;
  createdAt: string;
  updatedAt: string;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
};

export default function AdminForgotPassword() {
  const [config, setConfig] = useState<ForgotPasswordConfig | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [signupTemplateId, setSignupTemplateId] = useState<string>("");
  const [resetTemplateId, setResetTemplateId] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [cfgRes, tplRes] = await Promise.all([
          fetch("/api/admin/forgot-password-config"),
          fetch("/api/admin/email-templates"),
        ]);
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          const cfg = cfgData.forgotPasswordConfig;
          setConfig(cfg);
          setSignupTemplateId(cfg?.signupEmailTemplateId ?? "");
          setResetTemplateId(cfg?.resetEmailTemplateId ?? "");
        }
        if (tplRes.ok) {
          const tplData = await tplRes.json();
          setTemplates(tplData.emailTemplates ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load config.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/forgot-password-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupEmailTemplateId: signupTemplateId || null,
          resetEmailTemplateId: resetTemplateId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save config.");
      }
      setSuccess(true);
      const data = await res.json();
      setConfig(data.forgotPasswordConfig);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-admin-page flex min-h-[300px] items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-admin-page mx-admin-page--narrow">
      <div className="mx-admin-pageheader">
        <div>
        <h1>Forgot Password Configuration</h1>
        <p>
          Link email templates used for registration signup and password reset flows.
        </p>
        </div>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
        </div>
      )}

      {success && (
        <div className="mx-admin-alert mx-admin-alert--success">
          Configuration saved successfully.
        </div>
      )}

      <div className="mx-admin-card mx-admin-card-spacious space-y-6">
        <div className="space-y-2">
          <label className="mx-admin-form-label">Signup / Registration Template</label>
          <p className="text-xs text-muted-foreground">
            Used when a new user registers and needs an activation email.
          </p>
          <select
            className="mx-admin-select h-10 w-full px-3 py-2 transition-colors outline-none"
            value={signupTemplateId}
            onChange={(e) => setSignupTemplateId(e.target.value)}
          >
            <option value="">— None (use default template) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.subject}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="mx-admin-form-label">Password Reset Template</label>
          <p className="text-xs text-muted-foreground">
            Used when a user requests a password reset link.
          </p>
          <select
            className="mx-admin-select h-10 w-full px-3 py-2 transition-colors outline-none"
            value={resetTemplateId}
            onChange={(e) => setResetTemplateId(e.target.value)}
          >
            <option value="">— None (use default template) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.subject}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
            <SaveIcon className="mr-1.5 size-4" />
            Save Configuration
          </Button>
          {config && (
            <span className="text-xs text-muted-foreground">
              Last updated: {new Date(config.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
