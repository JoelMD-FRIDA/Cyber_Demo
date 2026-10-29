"use client";
import { apiFetch } from '@/lib/api-client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchIcon, ShieldIcon, Trash2Icon, UserIcon } from "lucide-react";
import { getApiErrorMessage, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudDialog, type CrudField } from "@/components/admin/crud-dialog";

type AdminUser = { id: string; email: string; username: string | null; firstname: string | null; lastname: string | null; company: string | null; role: "admin" | "user"; performedDomainChecks: number; createdAt: string };

export default function AdminUsers() {
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [search, setSearch] = useState(""); const [dialogOpen, setDialogOpen] = useState(false); const [dialogMode, setDialogMode] = useState<"create" | "edit">("edit"); const [dialogLoading, setDialogLoading] = useState(false); const [dialogError, setDialogError] = useState<string | null>(null); const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const fetchUsers = useCallback(async (pageNumber: number, searchQuery: string) => { try { setLoading(true); setError(null); const params = new URLSearchParams({ page: String(pageNumber), limit: "10" }); if (searchQuery) params.set("search", searchQuery); const response = await apiFetch(`/api/admin/users?${params}`); const data = await response.json(); if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t("common.retry"))); setUsers(data.users ?? []); setTotalPages(data.totalPages ?? 1); } catch (reason) { setError(reason instanceof Error ? reason.message : t("common.retry")); } finally { setLoading(false); } }, [locale, t]);
  useEffect(() => { void fetchUsers(page, search); }, [fetchUsers, page, search]);
  async function save(values: Record<string, unknown>) { setDialogLoading(true); setDialogError(null); try { const body = { ...values }; const response = await apiFetch(dialogMode === "create" ? "/api/admin/users" : `/api/admin/users/${editingUser?.id}`, { method: dialogMode === "create" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t("common.retry"))); setDialogOpen(false); setEditingUser(null); await fetchUsers(page, search); } catch (reason) { setDialogError(reason instanceof Error ? reason.message : t("common.retry")); } finally { setDialogLoading(false); } }
  async function remove(user: AdminUser) { if (!window.confirm(`${locale === "de" ? "Zugriff deaktivieren" : "Disable access"} ${user.email}?`)) return; const response = await apiFetch(`/api/admin/users/${user.id}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) setError(getApiErrorMessage(locale, data, t("common.retry"))); else await fetchUsers(page, search); }
  const fields = useMemo<CrudField[]>(() => [{ name: "firstname", label: t("auth.firstName") }, { name: "lastname", label: t("auth.lastName") }, { name: "username", label: t("auth.username") }, { name: "role", label: t("profile.role"), type: "select", options: [{ value: "user", label: t("admin.user") }, { value: "admin", label: t("admin.admin") }] }, { name: "company", label: t("auth.company") }, ] as CrudField[], [dialogMode, t]);
  const columns = useMemo<Column<AdminUser>[]>(() => [
    { key: "email", header: t("auth.email"), render: (user) => user.email },
    { key: "username", header: t("auth.username"), render: (user) => user.username || "—" },
    { key: "name", header: t("profile.name"), render: (user) => [user.firstname, user.lastname].filter(Boolean).join(" ") || "—" },
    { key: "role", header: t("profile.role"), render: (user) => user.role === "admin" ? <Badge className="gap-1 bg-amber-600"><ShieldIcon className="size-3" />{t("admin.admin")}</Badge> : <Badge variant="secondary" className="gap-1"><UserIcon className="size-3" />{t("admin.user")}</Badge> },
    { key: "company", header: t("auth.company"), render: (user) => user.company || "—" },
    { key: "checks", header: t("admin.checkCount"), render: (user) => user.performedDomainChecks },
    { key: "created", header: t("admin.created"), render: (user) => new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US").format(new Date(user.createdAt)) },
    { key: "actions", header: "", className: "w-[80px] text-right", render: (user) => <div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" onClick={() => { setEditingUser(user); setDialogMode("edit"); setDialogError(null); setDialogOpen(true); }} aria-label={`${t("common.edit")} ${user.email}`}><ShieldIcon className="size-3.5" /></Button><Button variant="ghost" size="icon-sm" onClick={() => void remove(user)} aria-label={`${t("common.delete")} ${user.email}`}><Trash2Icon className="size-3.5 text-destructive" /></Button></div> },
  ], [locale, t]);
  return <div className="mx-admin-page"><div className="mx-admin-pageheader"><div><h1>{t("admin.usersTitle")}</h1><p>{t("admin.usersSubtitle")}</p></div></div><div className="mb-4 max-w-sm"><div className="relative"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder={t("common.search")} className="pl-8" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div></div>{error && <div className="mx-admin-alert mx-admin-alert--error">{error}<button className="ml-2 underline" onClick={() => void fetchUsers(page, search)}>{t("common.retry")}</button></div>}<DataTable columns={columns} data={users} keyExtractor={(user) => user.id} loading={loading} emptyMessage={t("common.noResults")} page={page} totalPages={totalPages} onPageChange={setPage} /><CrudDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingUser(null); }} mode={dialogMode} title={dialogMode === "create" ? t("common.add") : t("common.edit")} fields={fields} onSubmit={save} loading={dialogLoading} error={dialogError} defaultValues={editingUser ? { firstname: editingUser.firstname ?? "", lastname: editingUser.lastname ?? "", username: editingUser.username ?? "", role: editingUser.role, company: editingUser.company ?? "" } : { role: "user" }} /></div>;
}
