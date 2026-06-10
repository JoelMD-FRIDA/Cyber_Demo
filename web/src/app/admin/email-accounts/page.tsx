"use client"

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudDialog, type CrudField } from "@/components/admin/crud-dialog";
import { IntegrationStatusCard } from "@/components/admin/integration-status-card";
import type { IntegrationEntry, IntegrationsStatusResponse } from "@/app/api/admin/integrations/status/route";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";

type OutgoingConfig = {
  id: string;
  emailAccountId: string;
  serverHost: string;
  serverPort: number;
  outgoingProtocol: number;
  ssl: boolean;
  tls: boolean;
};

type EmailAccount = {
  id: string;
  mailAddress: string;
  username: string;
  fromDisplayName: string;
  isOutgoingEmailConfigured: boolean;
  isSharedMailbox: boolean;
  outgoingConfig: OutgoingConfig | null;
  createdAt: string;
};

const columns: Column<EmailAccount>[] = [
  {
    key: "mailAddress",
    header: "Mail Address",
    render: (a) => (
      <span className="font-medium">{a.mailAddress}</span>
    ),
  },
  {
    key: "fromDisplayName",
    header: "Display Name",
    render: (a) => a.fromDisplayName || <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: "username",
    header: "Username",
    render: (a) => a.username,
  },
  {
    key: "outgoingConfig",
    header: "SMTP Host",
    render: (a) =>
      a.outgoingConfig ? (
        <span className="text-muted-foreground">{a.outgoingConfig.serverHost}:{a.outgoingConfig.serverPort}</span>
      ) : (
        <Badge variant="outline" className="text-amber-600 border-amber-300">Not configured</Badge>
      ),
  },
  {
    key: "isOutgoingEmailConfigured",
    header: "Status",
    render: (a) =>
      a.isOutgoingEmailConfigured ? (
        <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-600/80">Active</Badge>
      ) : (
        <Badge variant="secondary">Inactive</Badge>
      ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (a) => {
      const date = new Date(a.createdAt);
      return <span className="text-muted-foreground text-xs">{date.toLocaleDateString()}</span>;
    },
  },
];

const formFields: CrudField[] = [
  { name: "mailAddress", label: "Mail Address", type: "email", placeholder: "smtp@example.com", required: true },
  { name: "username", label: "SMTP Username", placeholder: "user@example.com", required: true },
  { name: "password", label: "SMTP Password", type: "password", placeholder: "••••••••", required: true },
  { name: "fromDisplayName", label: "From Display Name", placeholder: "Cyber-Vorabcheck" },
  { name: "serverHost", label: "SMTP Host", placeholder: "smtp.example.com" },
  { name: "serverPort", label: "SMTP Port", type: "number", placeholder: "587" },
  {
    name: "outgoingProtocol",
    label: "Protocol",
    type: "select",
    options: [
      { value: "0", label: "SMTP" },
      { value: "1", label: "SMTPS" },
    ],
  },
  {
    name: "ssl",
    label: "Use SSL",
    type: "select",
    options: [
      { value: "false", label: "No" },
      { value: "true", label: "Yes" },
    ],
  },
  {
    name: "tls",
    label: "Use TLS",
    type: "select",
    options: [
      { value: "false", label: "No" },
      { value: "true", label: "Yes" },
    ],
  },
];

const editFormFields: CrudField[] = [
  { name: "mailAddress", label: "Mail Address", type: "email", placeholder: "smtp@example.com", required: true },
  { name: "username", label: "SMTP Username", placeholder: "user@example.com", required: true },
  { name: "password", label: "SMTP Password (leave blank to keep current)", type: "password", placeholder: "••••••••" },
  { name: "fromDisplayName", label: "From Display Name", placeholder: "Cyber-Vorabcheck" },
  { name: "serverHost", label: "SMTP Host", placeholder: "smtp.example.com" },
  { name: "serverPort", label: "SMTP Port", type: "number", placeholder: "587" },
  {
    name: "outgoingProtocol",
    label: "Protocol",
    type: "select",
    options: [
      { value: "0", label: "SMTP" },
      { value: "1", label: "SMTPS" },
    ],
  },
  {
    name: "ssl",
    label: "Use SSL",
    type: "select",
    options: [
      { value: "false", label: "No" },
      { value: "true", label: "Yes" },
    ],
  },
  {
    name: "tls",
    label: "Use TLS",
    type: "select",
    options: [
      { value: "false", label: "No" },
      { value: "true", label: "Yes" },
    ],
  },
];

export default function AdminEmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<IntegrationEntry | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/email-accounts");
      if (!res.ok) throw new Error("Failed to load email accounts.");
      const data = await res.json();
      setAccounts(data.emailAccounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSmtpStatus = useCallback(async () => {
    try {
      setStatusError(null);
      const res = await fetch("/api/admin/integrations/status");
      if (!res.ok) throw new Error("Failed to load SMTP configuration status.");
      const data: IntegrationsStatusResponse = await res.json();
      setSmtpStatus(data.integrations.find((integration) => integration.id === "smtp") ?? null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to load SMTP configuration status.");
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchSmtpStatus();
  }, [fetchAccounts, fetchSmtpStatus]);

  async function handleCreate(data: Record<string, unknown>) {
    setDialogLoading(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = {
        mailAddress: data.mailAddress,
        username: data.username,
        password: data.password,
        fromDisplayName: data.fromDisplayName || null,
      };
      if (data.serverHost) body.serverHost = data.serverHost;
      if (data.serverPort) body.serverPort = parseInt(data.serverPort as string, 10);
      if (data.outgoingProtocol !== undefined && data.outgoingProtocol !== "") {
        body.outgoingProtocol = parseInt(data.outgoingProtocol as string, 10);
      }
      if (data.ssl !== undefined && data.ssl !== "") body.ssl = data.ssl === "true";
      if (data.tls !== undefined && data.tls !== "") body.tls = data.tls === "true";

      const res = await fetch("/api/admin/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create email account.");
      }
      setDialogOpen(false);
      await fetchAccounts();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleEdit(data: Record<string, unknown>) {
    if (!editingAccount) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = {};
      if (data.mailAddress !== editingAccount.mailAddress) body.mailAddress = data.mailAddress;
      if (data.username !== editingAccount.username) body.username = data.username;
      if (data.password) body.password = data.password;
      if (data.fromDisplayName !== (editingAccount.fromDisplayName ?? "")) body.fromDisplayName = data.fromDisplayName || null;
      if (data.serverHost !== (editingAccount.outgoingConfig?.serverHost ?? "")) body.serverHost = data.serverHost || null;
      if (data.serverPort !== undefined) body.serverPort = parseInt(data.serverPort as string, 10);
      if (data.outgoingProtocol !== undefined && data.outgoingProtocol !== "") {
        body.outgoingProtocol = parseInt(data.outgoingProtocol as string, 10);
      }
      if (data.ssl !== undefined && data.ssl !== "") body.ssl = data.ssl === "true";
      if (data.tls !== undefined && data.tls !== "") body.tls = data.tls === "true";

      const res = await fetch(`/api/admin/email-accounts/${editingAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update email account.");
      }
      setDialogOpen(false);
      setEditingAccount(null);
      await fetchAccounts();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleDelete(account: EmailAccount) {
    if (!window.confirm(`Are you sure you want to delete "${account.mailAddress}"?`)) return;
    try {
      const res = await fetch(`/api/admin/email-accounts/${account.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete email account.");
      }
      await fetchAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  function openCreateDialog() {
    setDialogMode("create");
    setEditingAccount(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEditDialog(account: EmailAccount) {
    setDialogMode("edit");
    setEditingAccount(account);
    setDialogError(null);
    setDialogOpen(true);
  }

  const actionColumn: Column<EmailAccount> = {
    key: "actions",
    header: "",
    className: "w-[100px] text-right",
    render: (a) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(a)}>
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Edit {a.mailAddress}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(a)}>
          <Trash2Icon className="size-3.5 text-destructive" />
          <span className="sr-only">Delete {a.mailAddress}</span>
        </Button>
      </div>
    ),
  };

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Email Accounts</h1>
          <p>
            Manage SMTP email accounts for sending transactional emails.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-1.5 size-4" />
          Add Account
        </Button>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
          <button className="ml-2 underline hover:no-underline" onClick={fetchAccounts}>Retry</button>
        </div>
      )}

      {statusError && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {statusError}
          <button className="ml-2 underline hover:no-underline" onClick={fetchSmtpStatus}>Retry</button>
        </div>
      )}

      {smtpStatus && <IntegrationStatusCard entry={smtpStatus} />}

      <DataTable
        columns={[...columns, actionColumn]}
        data={accounts}
        keyExtractor={(a) => a.id}
        loading={loading}
        emptyMessage="No email accounts configured. Add an SMTP account to enable email sending."
      />

      <CrudDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingAccount(null);
        }}
        mode={dialogMode}
        title={dialogMode === "create" ? "Add Email Account" : "Edit Email Account"}
        fields={dialogMode === "create" ? formFields : editFormFields}
        onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
        loading={dialogLoading}
        error={dialogError}
        defaultValues={
          editingAccount
            ? {
                mailAddress: editingAccount.mailAddress,
                username: editingAccount.username,
                password: "",
                fromDisplayName: editingAccount.fromDisplayName ?? "",
                serverHost: editingAccount.outgoingConfig?.serverHost ?? "",
                serverPort: String(editingAccount.outgoingConfig?.serverPort ?? 587),
                outgoingProtocol: String(editingAccount.outgoingConfig?.outgoingProtocol ?? 0),
                ssl: editingAccount.outgoingConfig?.ssl ? "true" : "false",
                tls: editingAccount.outgoingConfig?.tls ? "true" : "false",
              }
            : { serverPort: "587", outgoingProtocol: "0", ssl: "false", tls: "false" }
        }
      />
    </div>
  );
}
