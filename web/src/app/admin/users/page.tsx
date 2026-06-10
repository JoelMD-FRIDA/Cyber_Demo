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
  ShieldIcon,
  UserIcon,
} from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  company: string | null;
  role: "admin" | "user";
  isActivated: boolean;
  performedDomainChecks: number;
  createdAt: string;
};

const columns: Column<AdminUser>[] = [
  { key: "email", header: "Email", render: (u) => u.email },
  {
    key: "username",
    header: "Username",
    render: (u) =>
      u.username || <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: "name",
    header: "Name",
    render: (u) => {
      const fullName = [u.firstname, u.lastname].filter(Boolean).join(" ");
      return fullName || <span className="text-muted-foreground/50">—</span>;
    },
  },
  {
    key: "role",
    header: "Role",
    render: (u) =>
      u.role === "admin" ? (
        <Badge variant="default" className="bg-amber-600 text-white hover:bg-amber-600/80 gap-1">
          <ShieldIcon className="size-3" />
          Admin
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1">
          <UserIcon className="size-3" />
          User
        </Badge>
      ),
  },
  {
    key: "isActivated",
    header: "Activated",
    render: (u) =>
      u.isActivated ? (
        <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-600/80">
          Active
        </Badge>
      ) : (
        <Badge variant="outline">Pending</Badge>
      ),
  },
  {
    key: "company",
    header: "Company",
    render: (u) =>
      u.company || <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: "createdAt",
    header: "Joined",
    render: (u) => {
      const date = new Date(u.createdAt);
      return (
        <span className="text-muted-foreground text-xs">
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
];

const editFields: CrudField[] = [
  {
    name: "firstname",
    label: "First Name",
    placeholder: "John",
  },
  {
    name: "lastname",
    label: "Last Name",
    placeholder: "Doe",
  },
  {
    name: "username",
    label: "Username",
    placeholder: "johndoe",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    placeholder: "john@example.com",
  },
  {
    name: "role",
    label: "Role",
    type: "select",
    options: [
      { value: "user", label: "User" },
      { value: "admin", label: "Admin" },
    ],
  },
  {
    name: "company",
    label: "Company",
    placeholder: "Acme Inc.",
  },
];

const createFields: CrudField[] = [
  ...editFields,
  {
    name: "password",
    label: "Password",
    type: "password",
    placeholder: "••••••••",
    required: true,
  },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("edit");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async (pageNum: number, searchQuery: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), limit: "10" });
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to load users.");
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page, search);
  }, [page, fetchUsers]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    fetchUsers(1, value);
  }

  async function handleEdit(data: Record<string, unknown>) {
    if (!editingUser) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = {};
      if (data.firstname !== (editingUser.firstname ?? "")) body.firstname = data.firstname || null;
      if (data.lastname !== (editingUser.lastname ?? "")) body.lastname = data.lastname || null;
      if (data.username !== (editingUser.username ?? "")) body.username = data.username || null;
      if (data.email !== editingUser.email) body.email = data.email;
      if (data.role !== editingUser.role) body.role = data.role;
      if (data.company !== (editingUser.company ?? "")) body.company = data.company || null;
      if (data.password) body.password = data.password;

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user.");
      }
      setDialogOpen(false);
      setEditingUser(null);
      await fetchUsers(page, search);
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
        email: data.email,
        password: data.password,
      };
      if (data.firstname) body.firstname = data.firstname;
      if (data.lastname) body.lastname = data.lastname;
      if (data.username) body.username = data.username;
      if (data.role) body.role = data.role;
      if (data.company) body.company = data.company;

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user.");
      }
      setDialogOpen(false);
      await fetchUsers(page, search);
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!window.confirm(`Are you sure you want to delete user "${user.email}"?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user.");
      }
      await fetchUsers(page, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  function openEditDialog(user: AdminUser) {
    setEditingUser(user);
    setDialogMode("edit");
    setDialogError(null);
    setDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingUser(null);
    setDialogMode("create");
    setDialogError(null);
    setDialogOpen(true);
  }

  const actionColumn: Column<AdminUser> = {
    key: "actions",
    header: "",
    className: "w-[80px] text-right",
    render: (u) => (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openEditDialog(u)}
        >
          <ShieldIcon className="size-3.5" />
          <span className="sr-only">Edit {u.email}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleDelete(u)}
        >
          <Trash2Icon className="size-3.5 text-destructive" />
          <span className="sr-only">Delete {u.email}</span>
        </Button>
      </div>
    ),
  };

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Users</h1>
          <p>
            Manage platform users and their roles.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          Create User
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
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
            onClick={() => fetchUsers(page, search)}
          >
            Retry
          </button>
        </div>
      )}

      <DataTable
        columns={[...columns, actionColumn]}
        data={users}
        keyExtractor={(u) => u.id}
        loading={loading}
        emptyMessage={
          search
            ? `No users matching "${search}".`
            : "No users found."
        }
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <CrudDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingUser(null);
        }}
        mode={dialogMode}
        title={dialogMode === "create" ? "Create User" : "Edit User"}
        fields={dialogMode === "create" ? createFields : editFields}
        onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
        loading={dialogLoading}
        error={dialogError}
        defaultValues={
          editingUser
            ? {
                firstname: editingUser.firstname ?? "",
                lastname: editingUser.lastname ?? "",
                username: editingUser.username ?? "",
                email: editingUser.email,
                role: editingUser.role,
                company: editingUser.company ?? "",
              }
            : {}
        }
      />
    </div>
  );
}
