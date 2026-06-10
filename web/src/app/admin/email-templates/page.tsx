"use client"

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { PlusIcon, PencilIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  fromAddress: string | null;
  fromDisplayName: string | null;
  languages: Array<{ id: string; code: string; description: string }>;
  smtpAccounts: Array<{ id: string; mailAddress: string }>;
  createdAt: string;
};

type SystemLanguage = {
  id: string;
  code: string;
  description: string;
};

type EmailAccount = {
  id: string;
  mailAddress: string;
};

const columns: Column<EmailTemplate>[] = [
  {
    key: "name",
    header: "Name",
    render: (t) => <span className="font-medium">{t.name}</span>,
  },
  {
    key: "subject",
    header: "Subject",
    render: (t) => (
      <span className="text-muted-foreground max-w-[250px] truncate inline-block">
        {t.subject}
      </span>
    ),
  },
  {
    key: "languages",
    header: "Languages",
    render: (t) => (
      <div className="flex gap-1 flex-wrap">
        {t.languages.length > 0 ? (
          t.languages.map((l) => (
            <Badge key={l.id} variant="secondary" className="text-xs">
              {l.code}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </div>
    ),
  },
  {
    key: "fromAddress",
    header: "From",
    render: (t) =>
      t.fromAddress ? (
        <span className="text-xs text-muted-foreground">{t.fromAddress}</span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (t) => {
      const date = new Date(t.createdAt);
      return <span className="text-muted-foreground text-xs">{date.toLocaleDateString()}</span>;
    },
  },
];

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [languages, setLanguages] = useState<SystemLanguage[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formFromAddress, setFormFromAddress] = useState("");
  const [formFromDisplayName, setFormFromDisplayName] = useState("");
  const [selectedLanguageIds, setSelectedLanguageIds] = useState<string[]>([]);
  const [selectedSmtpAccountIds, setSelectedSmtpAccountIds] = useState<string[]>([]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tRes, lRes, aRes] = await Promise.all([
        fetch("/api/admin/email-templates"),
        fetch("/api/system-languages"),
        fetch("/api/admin/email-accounts"),
      ]);
      if (!tRes.ok) throw new Error("Failed to load email templates.");
      const tData = await tRes.json();
      setTemplates(tData.emailTemplates ?? []);

      if (lRes.ok) {
        const lData = await lRes.json();
        setLanguages(lData.languages ?? []);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setSmtpAccounts(aData.emailAccounts ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function resetForm() {
    setFormName("");
    setFormSubject("");
    setFormBody("");
    setFormFromAddress("");
    setFormFromDisplayName("");
    setSelectedLanguageIds([]);
    setSelectedSmtpAccountIds([]);
    setEditorError(null);
  }

  function openCreateDialog() {
    setEditorMode("create");
    setEditingTemplate(null);
    resetForm();
    setEditorOpen(true);
  }

  function openEditDialog(tmpl: EmailTemplate) {
    setEditorMode("edit");
    setEditingTemplate(tmpl);
    setFormName(tmpl.name);
    setFormSubject(tmpl.subject);
    setFormBody(tmpl.body);
    setFormFromAddress(tmpl.fromAddress ?? "");
    setFormFromDisplayName(tmpl.fromDisplayName ?? "");
    setSelectedLanguageIds(tmpl.languages.map((l) => l.id));
    setSelectedSmtpAccountIds(tmpl.smtpAccounts.map((a) => a.id));
    setEditorError(null);
    setEditorOpen(true);
  }

  function toggleLanguage(langId: string) {
    setSelectedLanguageIds((prev) =>
      prev.includes(langId) ? prev.filter((id) => id !== langId) : [...prev, langId],
    );
  }

  function toggleSmtpAccount(acctId: string) {
    setSelectedSmtpAccountIds((prev) =>
      prev.includes(acctId) ? prev.filter((id) => id !== acctId) : [...prev, acctId],
    );
  }

  async function handleCreate() {
    if (!formName || !formSubject || !formBody) {
      setEditorError("Name, subject, and body are required.");
      return;
    }
    setEditorLoading(true);
    setEditorError(null);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          subject: formSubject,
          body: formBody,
          fromAddress: formFromAddress || null,
          fromDisplayName: formFromDisplayName || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create template.");
      }
      const { emailTemplate } = await res.json();

      if (selectedLanguageIds.length > 0 || selectedSmtpAccountIds.length > 0) {
        await fetch(`/api/admin/email-templates/${emailTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            languageIds: selectedLanguageIds,
            smtpAccountIds: selectedSmtpAccountIds,
          }),
        });
      }

      setEditorOpen(false);
      await fetchTemplates();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setEditorLoading(false);
    }
  }

  async function handleEdit() {
    if (!editingTemplate) return;
    if (!formName || !formSubject || !formBody) {
      setEditorError("Name, subject, and body are required.");
      return;
    }
    setEditorLoading(true);
    setEditorError(null);
    try {
      const res = await fetch(`/api/admin/email-templates/${editingTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          subject: formSubject,
          body: formBody,
          fromAddress: formFromAddress || null,
          fromDisplayName: formFromDisplayName || null,
          languageIds: selectedLanguageIds,
          smtpAccountIds: selectedSmtpAccountIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update template.");
      }
      setEditorOpen(false);
      setEditingTemplate(null);
      await fetchTemplates();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setEditorLoading(false);
    }
  }

  async function handleDelete(tmpl: EmailTemplate) {
    if (!window.confirm(`Are you sure you want to delete template "${tmpl.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/email-templates/${tmpl.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete template.");
      }
      await fetchTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  const actionColumn: Column<EmailTemplate> = {
    key: "actions",
    header: "",
    className: "w-[100px] text-right",
    render: (t) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(t)}>
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Edit {t.name}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(t)}>
          <Trash2Icon className="size-3.5 text-destructive" />
          <span className="sr-only">Delete {t.name}</span>
        </Button>
      </div>
    ),
  };

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Email Templates</h1>
          <p>
            Manage email templates used for registration, password reset, and other notifications.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-1.5 size-4" />
          Add Template
        </Button>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
          <button className="ml-2 underline hover:no-underline" onClick={fetchTemplates}>Retry</button>
        </div>
      )}

      <DataTable
        columns={[...columns, actionColumn]}
        data={templates}
        keyExtractor={(t) => t.id}
        loading={loading}
        emptyMessage="No email templates found. Create your first template to get started."
      />

      <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) setEditingTemplate(null); }}>
        <DialogContent className="mx-admin-dialog max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editorMode === "create" ? "Add Email Template" : "Edit Email Template"}</DialogTitle>
            <DialogDescription>
              {editorMode === "create"
                ? "Create a new email template with Handlebars syntax."
                : "Update the email template fields below."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="mx-admin-form-label">Name *</label>
              <Input
                placeholder="e.g. registration, forgot-password"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="mx-admin-form-label">Subject *</label>
              <Input
                placeholder="Subject line with {{variables}}"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="mx-admin-form-label">From Address</label>
              <Input
                type="email"
                placeholder="noreply@example.com"
                value={formFromAddress}
                onChange={(e) => setFormFromAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="mx-admin-form-label">From Display Name</label>
              <Input
                placeholder="Cyber-Vorabcheck"
                value={formFromDisplayName}
                onChange={(e) => setFormFromDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="mx-admin-form-label">HTML Body *</label>
              <textarea
                className="mx-admin-textarea h-48 w-full p-2.5 font-mono transition-colors outline-none placeholder:text-muted-foreground"
                placeholder="<html>Handlebars {{variables}} here</html>"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="mx-admin-form-label">Linked Languages</label>
              {languages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No languages configured in system.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => toggleLanguage(lang.id)}
                      className={`mx-admin-chip ${
                        selectedLanguageIds.includes(lang.id)
                          ? "mx-admin-chip--selected"
                          : ""
                      }`}
                    >
                      {lang.code} — {lang.description}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="mx-admin-form-label">Linked SMTP Accounts</label>
              {smtpAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No email accounts configured.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {smtpAccounts.map((acct) => (
                    <button
                      key={acct.id}
                      type="button"
                      onClick={() => toggleSmtpAccount(acct.id)}
                      className={`mx-admin-chip ${
                        selectedSmtpAccountIds.includes(acct.id)
                          ? "mx-admin-chip--selected"
                          : ""
                      }`}
                    >
                      {acct.mailAddress}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {editorError && (
            <p className="text-sm text-destructive mt-2">{editorError}</p>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={editorLoading}>
              Cancel
            </Button>
            <Button onClick={editorMode === "create" ? handleCreate : handleEdit} disabled={editorLoading}>
              {editorLoading && <Loader2Icon className="mr-1 size-3.5 animate-spin" />}
              {editorMode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
