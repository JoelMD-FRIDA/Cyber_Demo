"use client"

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudDialog, type CrudField } from "@/components/admin/crud-dialog";
import { PlusIcon, PencilIcon, Trash2Icon, ImageIcon, Loader2Icon } from "lucide-react";

type Category = {
  id: string;
  uuid: string;
  name: string;
  description: string | null;
  iconFileDocumentId: string | null;
  createdAt: string;
};

const columns: Column<Category>[] = [
  {
    key: "icon",
    header: "Icon",
    render: (c) =>
      c.iconFileDocumentId ? (
        <img
          src={`/api/files/${c.iconFileDocumentId}`}
          alt={`${c.name} icon`}
          className="h-8 w-8 rounded object-contain bg-muted"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground/40">
          <ImageIcon className="size-4" />
        </div>
      ),
  },
  { key: "name", header: "Name", render: (c) => c.name },
  {
    key: "description",
    header: "Description",
    render: (c) =>
      c.description ? (
        <span className="text-muted-foreground max-w-[300px] truncate inline-block">
          {c.description}
        </span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (c) => {
      const date = new Date(c.createdAt);
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
    placeholder: "e.g. Malware Analysis",
    required: true,
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Brief description of this category...",
  },
];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [uploadingIconFor, setUploadingIconFor] = useState<string | null>(null);
  const [iconUploadError, setIconUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to load categories.");
      const data = await res.json();
      setCategories(data.categories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleCreate(data: Record<string, unknown>) {
    setDialogLoading(true);
    setDialogError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create category.");
      }
      setDialogOpen(false);
      await fetchCategories();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleEdit(data: Record<string, unknown>) {
    if (!editingCategory) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = {};
      if (data.name !== editingCategory.name) body.name = data.name;
      if (data.description !== (editingCategory.description ?? "")) body.description = data.description || null;

      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update category.");
      }
      setDialogOpen(false);
      setEditingCategory(null);
      await fetchCategories();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete category.");
      }
      await fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  async function handleIconUpload(categoryId: string, file: File) {
    setUploadingIconFor(categoryId);
    setIconUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/categories/${categoryId}/icon`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload icon.");
      }
      await fetchCategories();
    } catch (e) {
      setIconUploadError(e instanceof Error ? e.message : "Failed to upload icon.");
    } finally {
      setUploadingIconFor(null);
      setUploadTargetId(null);
    }
  }

  async function handleIconDelete(category: Category) {
    if (!window.confirm(`Remove icon for "${category.name}"?`)) return;
    try {
      const res = await fetch(`/api/categories/${category.id}/icon`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete icon.");
      }
      await fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  function openCreateDialog() {
    setDialogMode("create");
    setEditingCategory(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setDialogMode("edit");
    setEditingCategory(category);
    setDialogError(null);
    setDialogOpen(true);
  }

  function triggerIconUpload(categoryId: string) {
    setUploadTargetId(categoryId);
    setIconUploadError(null);
    fileInputRef.current?.click();
  }

  const actionColumn: Column<Category> = {
    key: "actions",
    header: "",
    className: "w-[140px] text-right",
    render: (c) => (
      <div className="flex justify-end gap-1">
        {uploadingIconFor === c.id ? (
          <Button variant="ghost" size="icon-sm" disabled>
            <Loader2Icon className="size-3.5 animate-spin" />
            <span className="sr-only">Uploading icon for {c.name}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => triggerIconUpload(c.id)}
          >
            {c.iconFileDocumentId ? (
              <ImageIcon className="size-3.5 text-emerald-600" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
            <span className="sr-only">Upload icon for {c.name}</span>
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(c)}>
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Edit {c.name}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c)}>
          <Trash2Icon className="size-3.5 text-destructive" />
          <span className="sr-only">Delete {c.name}</span>
        </Button>
      </div>
    ),
  };

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Categories</h1>
          <p>
            Manage domain check categories.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-1.5 size-4" />
          Add Category
        </Button>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
          <button
            className="ml-2 underline hover:no-underline"
            onClick={fetchCategories}
          >
            Retry
          </button>
        </div>
      )}

      {iconUploadError && (
        <div className="mx-admin-alert mx-admin-alert--warning">
          {iconUploadError}
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
            handleIconUpload(uploadTargetId, file);
          }
          e.target.value = "";
        }}
      />

      <DataTable
        columns={[...columns, actionColumn]}
        data={categories}
        keyExtractor={(c) => c.id}
        loading={loading}
        emptyMessage="No categories found. Create your first category to get started."
      />

      <CrudDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        mode={dialogMode}
        title={dialogMode === "create" ? "Add Category" : "Edit Category"}
        fields={formFields}
        onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
        loading={dialogLoading}
        error={dialogError}
        defaultValues={
          editingCategory
            ? {
                name: editingCategory.name,
                description: editingCategory.description ?? "",
              }
            : {}
        }
      />
    </div>
  );
}
