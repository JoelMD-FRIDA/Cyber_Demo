"use client"

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudDialog, type CrudField } from "@/components/admin/crud-dialog";
import { Input } from "@/components/ui/input";
import {
  Trash2Icon,
  SearchIcon,
  KeyIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
} from "lucide-react";

type RegistrationKey = {
  id: string;
  code: string;
  company: string | null;
  companyDomain: string | null;
  totalSlots: number;
  usedCount: number;
  enabled: boolean;
  expiresAt: string | null;
  createdAt: string;
};

const columns: Column<RegistrationKey>[] = [
  { key: "code", header: "Code", render: (k) => <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">{k.code}</code> },
  {
    key: "company",
    header: "Company",
    render: (k) =>
      k.company || <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: "companyDomain",
    header: "Domain",
    render: (k) =>
      k.companyDomain || <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: "usage",
    header: "Usage",
    render: (k) => (
      <span className="text-sm">
        {k.usedCount} / {k.totalSlots}
      </span>
    ),
  },
  {
    key: "enabled",
    header: "Status",
    render: (k) => {
      if (!k.enabled) {
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <XCircleIcon className="size-3" />
            Disabled
          </Badge>
        );
      }
      if (k.expiresAt && new Date(k.expiresAt) < new Date()) {
        return (
          <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
            <ClockIcon className="size-3" />
            Expired
          </Badge>
        );
      }
      return (
        <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-600/80 gap-1">
          <CheckCircle2Icon className="size-3" />
          Active
        </Badge>
      );
    },
  },
  {
    key: "expiresAt",
    header: "Expires",
    render: (k) => {
      if (!k.expiresAt) return <span className="text-muted-foreground/50">—</span>;
      const date = new Date(k.expiresAt);
      const expired = date < new Date();
      return (
        <span className={`text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
  {
    key: "createdAt",
    header: "Created",
    render: (k) => {
      const date = new Date(k.createdAt);
      return (
        <span className="text-muted-foreground text-xs">
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
];

const createFields: CrudField[] = [
  {
    name: "code",
    label: "Code",
    placeholder: "e.g. LAUNCH-2025-001",
    required: true,
  },
  {
    name: "totalSlots",
    label: "Total Slots",
    type: "number",
    placeholder: "10",
    required: true,
  },
  {
    name: "company",
    label: "Company",
    placeholder: "Acme Inc.",
  },
  {
    name: "companyDomain",
    label: "Company Domain",
    placeholder: "acme.com",
  },
  {
    name: "enabled",
    label: "Enabled",
    type: "select",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    name: "expiresAt",
    label: "Expires At",
    type: "text",
    placeholder: "2025-12-31 (optional)",
  },
];

const editFields: CrudField[] = createFields.map((f) =>
  f.name === "code" ? { ...f, required: false } : f,
);

export default function AdminRegistrationKeys() {
  const [keys, setKeys] = useState<RegistrationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<RegistrationKey | null>(null);

  const fetchKeys = useCallback(async (pageNum: number, searchQuery: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), limit: "10" });
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/admin/registration-keys?${params}`);
      if (!res.ok) throw new Error("Failed to load registration keys.");
      const data = await res.json();
      setKeys(data.keys ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys(page, search);
  }, [page, fetchKeys]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    fetchKeys(1, value);
  }

  async function handleEdit(data: Record<string, unknown>) {
    if (!editingKey) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = {};
      if (data.code !== editingKey.code) body.code = data.code;
      if (Number(data.totalSlots) !== editingKey.totalSlots) body.totalSlots = Number(data.totalSlots);
      if (data.company !== (editingKey.company ?? "")) body.company = data.company || null;
      if (data.companyDomain !== (editingKey.companyDomain ?? "")) body.companyDomain = data.companyDomain || null;

      const newEnabled = data.enabled === "true";
      if (newEnabled !== editingKey.enabled) body.enabled = newEnabled;

      const newExpiresAt = data.expiresAt ? data.expiresAt as string : null;
      const oldExpiresAt = editingKey.expiresAt;
      if (newExpiresAt !== oldExpiresAt) body.expiresAt = newExpiresAt;

      const res = await fetch(`/api/admin/registration-keys/${editingKey.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update registration key.");
      }
      setDialogOpen(false);
      setEditingKey(null);
      await fetchKeys(page, search);
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleCreate(data: Record<string, unknown>) {
    setDialogLoading(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = {
        code: data.code,
        totalSlots: Number(data.totalSlots),
      };
      if (data.company) body.company = data.company;
      if (data.companyDomain) body.companyDomain = data.companyDomain;
      body.enabled = data.enabled === "true" || data.enabled === undefined;
      if (data.expiresAt) body.expiresAt = data.expiresAt;

      const res = await fetch("/api/admin/registration-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create registration key.");
      }
      setDialogOpen(false);
      await fetchKeys(page, search);
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleDelete(key: RegistrationKey) {
    if (!window.confirm(`Are you sure you want to delete key "${key.code}"?`)) return;

    try {
      const res = await fetch(`/api/admin/registration-keys/${key.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete registration key.");
      }
      await fetchKeys(page, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  function openEditDialog(key: RegistrationKey) {
    setEditingKey(key);
    setDialogMode("edit");
    setDialogError(null);
    setDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingKey(null);
    setDialogMode("create");
    setDialogError(null);
    setDialogOpen(true);
  }

  const actionColumn: Column<RegistrationKey> = {
    key: "actions",
    header: "",
    className: "w-[80px] text-right",
    render: (k) => (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openEditDialog(k)}
        >
          <KeyIcon className="size-3.5" />
          <span className="sr-only">Edit {k.code}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleDelete(k)}
        >
          <Trash2Icon className="size-3.5 text-destructive" />
          <span className="sr-only">Delete {k.code}</span>
        </Button>
      </div>
    ),
  };

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Registration Keys</h1>
          <p>
            Manage registration keys used to control access during sign-up.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          Create Key
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by code..."
            className="pl-8"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
          <button
            className="ml-2 underline hover:no-underline"
            onClick={() => fetchKeys(page, search)}
          >
            Retry
          </button>
        </div>
      )}

      <DataTable
        columns={[...columns, actionColumn]}
        data={keys}
        keyExtractor={(k) => k.id}
        loading={loading}
        emptyMessage={
          search
            ? `No registration keys matching "${search}".`
            : "No registration keys found."
        }
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <CrudDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingKey(null);
        }}
        mode={dialogMode}
        title={dialogMode === "create" ? "Create Registration Key" : "Edit Registration Key"}
        fields={dialogMode === "create" ? createFields : editFields}
        onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
        loading={dialogLoading}
        error={dialogError}
        defaultValues={
          editingKey
            ? {
                code: editingKey.code,
                totalSlots: String(editingKey.totalSlots),
                company: editingKey.company ?? "",
                companyDomain: editingKey.companyDomain ?? "",
                enabled: editingKey.enabled ? "true" : "false",
                expiresAt: editingKey.expiresAt
                  ? new Date(editingKey.expiresAt).toISOString().split("T")[0]
                  : "",
              }
            : {}
        }
      />
    </div>
  );
}
