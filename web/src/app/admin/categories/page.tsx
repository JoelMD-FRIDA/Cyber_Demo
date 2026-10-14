'use client';
import { apiFetch } from '@/lib/api-client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/admin/data-table';
import { CrudDialog, type CrudField } from '@/components/admin/crud-dialog';
import { ImageIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { getApiErrorMessage, useI18n } from '@/lib/i18n';

type Category = { id: string; categoryKey: string; name: string; description: string | null; assetPath: string | null };

export default function AdminCategories() {
  const { locale, t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fields: CrudField[] = [
    { name: 'categoryKey', label: t('admin.categoryKey'), placeholder: 'default', required: true },
    { name: 'name', label: t('common.name'), required: true },
    { name: 'description', label: t('common.description'), type: 'textarea' },
  ];
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/admin/categories');
      const data = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t('common.retry')));
      setCategories(data.categories ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.retry'));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => { void load(); }, [load]);

  async function save(values: Record<string, unknown>) {
    setDialogLoading(true);
    try {
      const response = await apiFetch(editing ? `/api/admin/categories/${editing.id}` : '/api/admin/categories', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t('common.retry')));
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : t('common.retry'));
    } finally {
      setDialogLoading(false);
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`${t('common.delete')} ${category.name}?`)) return;
    const response = await apiFetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) setError(getApiErrorMessage(locale, data, t('common.retry')));
    else await load();
  }

  async function upload(file: File) {
    const id = uploadTarget.current;
    if (!id) return;
    setUploading(id);
    const form = new FormData();
    form.append('file', file);
    const response = await apiFetch(`/api/admin/categories/${id}/asset`, { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok) setError(getApiErrorMessage(locale, data, t('common.retry')));
    else await load();
    setUploading(null);
    uploadTarget.current = null;
  }

  const columns: Column<Category>[] = [
    { key: 'asset', header: t('admin.asset'), render: (category) => category.assetPath ? <img src={category.assetPath} alt="" className="h-8 w-8 rounded object-contain" /> : <ImageIcon className="size-5 text-muted-foreground" /> },
    { key: 'key', header: t('admin.categoryKey'), render: (category) => <code>{category.categoryKey}</code> },
    { key: 'name', header: t('common.name'), render: (category) => category.name },
    { key: 'description', header: t('common.description'), render: (category) => <span className="max-w-[300px] truncate text-muted-foreground">{category.description || '—'}</span> },
    { key: 'actions', header: '', className: 'w-[140px] text-right', render: (category) => <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" disabled={uploading === category.id} onClick={() => { uploadTarget.current = category.id; inputRef.current?.click(); }} aria-label={t('admin.uploadAssetFor', { name: category.name })}>{uploading === category.id ? <Loader2Icon className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}</Button>
      <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(category); setDialogMode('edit'); setDialogError(null); setDialogOpen(true); }} aria-label={t('admin.editEntry', { name: category.name })}><PencilIcon className="size-3.5" /></Button>
      <Button variant="ghost" size="icon-sm" onClick={() => void remove(category)} aria-label={t('admin.deleteEntry', { name: category.name })}><Trash2Icon className="size-3.5 text-destructive" /></Button>
    </div> },
  ];

  return <div className="mx-admin-page">
    <div className="mx-admin-pageheader"><div><h1>{t('admin.categoriesTitle')}</h1><p>{t('admin.categoriesSubtitle')}</p></div><Button onClick={() => { setEditing(null); setDialogMode('create'); setDialogError(null); setDialogOpen(true); }}><PlusIcon className="mr-1.5 size-4" />{t('admin.addCategory')}</Button></div>
    {error && <div className="mx-admin-alert mx-admin-alert--error">{error}<button className="ml-2 underline" onClick={() => void load()}>{t('common.retry')}</button></div>}
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} />
    <DataTable columns={columns} data={categories} keyExtractor={(category) => category.id} loading={loading} emptyMessage={t('admin.noCategories')} />
    <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} mode={dialogMode} title={dialogMode === 'create' ? t('admin.addCategory') : t('common.edit')} fields={fields} onSubmit={save} loading={dialogLoading} error={dialogError} defaultValues={editing ? { categoryKey: editing.categoryKey, name: editing.name, description: editing.description ?? '' } : {}} />
  </div>;
}
