"use client"

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudDialog, type CrudField } from "@/components/admin/crud-dialog";
import { PlusIcon, PencilIcon, Trash2Icon, ImageIcon, Loader2Icon, XIcon } from "lucide-react";

type Provider = {
  id: string;
  uuid: string;
  name: string;
  isActive: boolean;
  websiteUrl: string | null;
  description: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  apiBaseUrl: string | null;
  logoFileDocumentId: string | null;
  createdAt: string;
};

const columns: Column<Provider>[] = [
  {
    key: "logo",
    header: "Logo",
    render: (p) =>
      p.logoFileDocumentId ? (
        <img
          src={`/api/files/${p.logoFileDocumentId}`}
          alt={`${p.name} logo`}
          className="h-8 w-8 rounded object-contain bg-muted"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground/40">
          <ImageIcon className="size-4" />
        </div>
      ),
  },
  { key: "name", header: "Name", render: (p) => p.name },
  {
    key: "shortDescription",
    header: "Short Description",
    render: (p) =>
      p.shortDescription ? (
        <span className="text-muted-foreground max-w-[200px] truncate inline-block text-xs">
          {p.shortDescription}
        </span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      ),
  },
  {
    key: "isActive",
    header: "Status",
    render: (p) =>
      p.isActive ? (
        <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-600/80">
          Active
        </Badge>
      ) : (
        <Badge variant="secondary">Inactive</Badge>
      ),
  },
  {
    key: "websiteUrl",
    header: "Website",
    render: (p) =>
      p.websiteUrl ? (
        <span className="text-muted-foreground max-w-[200px] truncate inline-block">
          {p.websiteUrl}
        </span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (p) => {
      const date = new Date(p.createdAt);
      return (
        <span className="text-muted-foreground text-xs">
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
];

const formFields: CrudField[] = [
  {
    name: "name",
    label: "Name",
    placeholder: "e.g. VirusTotal",
    required: true,
  },
  {
    name: "isActive",
    label: "Status",
    type: "select",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
  {
    name: "websiteUrl",
    label: "Website URL",
    type: "url",
    placeholder: "https://example.com",
  },
  {
    name: "apiBaseUrl",
    label: "API Base URL",
    type: "url",
    placeholder: "https://api.example.com/v1",
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Brief description of this provider...",
  },
  {
    name: "shortDescription",
    label: "Short Description",
    type: "textarea",
    placeholder: "A short, concise description (max 700 chars)...",
  },
  {
    name: "longDescription",
    label: "Long Description",
    type: "textarea",
    placeholder: "A detailed, extended description (max 2000 chars)...",
  },
];

export default function AdminProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const [uploadingLogoFor, setUploadingLogoFor] = useState<string | null>(null);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/providers");
      if (!res.ok) throw new Error("Failed to load providers.");
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  async function handleCreate(data: Record<string, unknown>) {
    setDialogLoading(true);
    setDialogError(null);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          isActive: data.isActive === "true",
          websiteUrl: data.websiteUrl || null,
          description: data.description || null,
          shortDescription: data.shortDescription || null,
          longDescription: data.longDescription || null,
          apiBaseUrl: data.apiBaseUrl || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create provider.");
      }
      setDialogOpen(false);
      await fetchProviders();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleEdit(data: Record<string, unknown>) {
    if (!editingProvider) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = {};
      if (data.name !== editingProvider.name) body.name = data.name;
      if (data.isActive !== undefined) body.isActive = data.isActive === "true";
      if (data.websiteUrl !== (editingProvider.websiteUrl ?? "")) body.websiteUrl = data.websiteUrl || null;
      if (data.description !== (editingProvider.description ?? "")) body.description = data.description || null;
      if (data.shortDescription !== (editingProvider.shortDescription ?? "")) body.shortDescription = data.shortDescription || null;
      if (data.longDescription !== (editingProvider.longDescription ?? "")) body.longDescription = data.longDescription || null;
      if (data.apiBaseUrl !== (editingProvider.apiBaseUrl ?? "")) body.apiBaseUrl = data.apiBaseUrl || null;

      const res = await fetch(`/api/providers/${editingProvider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update provider.");
      }
      setDialogOpen(false);
      setEditingProvider(null);
      await fetchProviders();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleDelete(provider: Provider) {
    if (!window.confirm(`Are you sure you want to delete "${provider.name}"?`)) return;

    try {
      const res = await fetch(`/api/providers/${provider.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete provider.");
      }
      await fetchProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  async function handleLogoUpload(providerId: string, file: File) {
    setUploadingLogoFor(providerId);
    setLogoUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/providers/${providerId}/logo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload logo.");
      }
      await fetchProviders();
    } catch (e) {
      setLogoUploadError(e instanceof Error ? e.message : "Failed to upload logo.");
    } finally {
      setUploadingLogoFor(null);
      setUploadTargetId(null);
    }
  }

  async function handleLogoDelete(provider: Provider) {
    if (!window.confirm(`Remove logo for "${provider.name}"?`)) return;
    try {
      const res = await fetch(`/api/providers/${provider.id}/logo`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete logo.");
      }
      await fetchProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  function openCreateDialog() {
    setDialogMode("create");
    setEditingProvider(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEditDialog(provider: Provider) {
    setDialogMode("edit");
    setEditingProvider(provider);
    setDialogError(null);
    setDialogOpen(true);
  }

  function triggerLogoUpload(providerId: string) {
    setUploadTargetId(providerId);
    setLogoUploadError(null);
    fileInputRef.current?.click();
  }

  const actionColumn: Column<Provider> = {
    key: "actions",
    header: "",
    className: "w-[140px] text-right",
    render: (p) => (
      <div className="flex justify-end gap-1">
        {uploadingLogoFor === p.id ? (
          <Button variant="ghost" size="icon-sm" disabled>
            <Loader2Icon className="size-3.5 animate-spin" />
            <span className="sr-only">Uploading logo for {p.name}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => triggerLogoUpload(p.id)}
          >
            {p.logoFileDocumentId ? (
              <ImageIcon className="size-3.5 text-emerald-600" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
            <span className="sr-only">Upload logo for {p.name}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openEditDialog(p)}
        >
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Edit {p.name}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleDelete(p)}
        >
          <Trash2Icon className="size-3.5 text-destructive" />
          <span className="sr-only">Delete {p.name}</span>
        </Button>
      </div>
    ),
  };

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Providers</h1>
          <p>
            Manage domain check providers.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-1.5 size-4" />
          Add Provider
        </Button>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
          <button
            className="ml-2 underline hover:no-underline"
            onClick={fetchProviders}
          >
            Retry
          </button>
        </div>
      )}

      {logoUploadError && (
        <div className="mx-admin-alert mx-admin-alert--warning">
          {logoUploadError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTargetId) {
            handleLogoUpload(uploadTargetId, file);
          }
          e.target.value = "";
        }}
      />

      <DataTable
        columns={[...columns, actionColumn]}
        data={providers}
        keyExtractor={(p) => p.id}
        loading={loading}
        emptyMessage="No providers found. Create your first provider to get started."
      />

      <CrudDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingProvider(null);
        }}
        mode={dialogMode}
        title={dialogMode === "create" ? "Add Provider" : "Edit Provider"}
        fields={formFields}
        onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
        loading={dialogLoading}
        error={dialogError}
        defaultValues={
          editingProvider
            ? {
                name: editingProvider.name,
                isActive: editingProvider.isActive ? "true" : "false",
                websiteUrl: editingProvider.websiteUrl ?? "",
                apiBaseUrl: editingProvider.apiBaseUrl ?? "",
                description: editingProvider.description ?? "",
                shortDescription: editingProvider.shortDescription ?? "",
                longDescription: editingProvider.longDescription ?? "",
              }
            : { isActive: "true" }
        }
      />
    </div>
  );
}
