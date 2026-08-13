'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/admin/data-table';
import { CrudDialog, type CrudField } from '@/components/admin/crud-dialog';
import { ImageIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { getApiErrorMessage, useI18n } from '@/lib/i18n';

type Provider = {
  id: string;
  providerKey: string;
  name: string;
  isActive: boolean;
  isConfigured: boolean;
  websiteUrl: string | null;
  description: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  assetPath: string | null;
};

export default function AdminProviders() {
  const { locale, t } = useI18n();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fields: CrudField[] = [
    { name: 'providerKey', label: t('admin.providerKey'), placeholder: 'cysmo', required: true },
    { name: 'name', label: t('common.name'), placeholder: 'Cysmo', required: true },
    { name: 'isActive', label: t('common.active'), type: 'select', options: [{ value: 'true', label: t('common.active') }, { value: 'false', label: t('common.inactive') }] },
    { name: 'websiteUrl', label: t('admin.website'), type: 'url' },
    { name: 'shortDescription', label: t('admin.shortDescription') },
    { name: 'longDescription', label: t('admin.longDescription'), type: 'textarea' },
  ];
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/providers');
      const data = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t('common.retry')));
      setProviders(data.providers ?? []);
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
      const response = await fetch(editing ? `/api/admin/providers/${editing.id}` : '/api/admin/providers', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, isActive: values.isActive !== 'false' }),
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

  async function remove(provider: Provider) {
    if (!window.confirm(`${t('common.delete')} ${provider.name}?`)) return;
    const response = await fetch(`/api/admin/providers/${provider.id}`, { method: 'DELETE' });
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
    const response = await fetch(`/api/admin/providers/${id}/asset`, { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok) setError(getApiErrorMessage(locale, data, t('common.retry')));
    else await load();
    setUploading(null);
    uploadTarget.current = null;
  }

  const columns: Column<Provider>[] = [
    { key: 'asset', header: t('admin.asset'), render: (provider) => provider.assetPath ? <img src={provider.assetPath} alt="" className="h-8 w-8 rounded object-contain" /> : <ImageIcon className="size-5 text-muted-foreground" /> },
    { key: 'key', header: t('admin.providerKey'), render: (provider) => <code>{provider.providerKey}</code> },
    { key: 'name', header: t('common.name'), render: (provider) => provider.name },
    { key: 'configured', header: t('admin.runtime'), render: (provider) => provider.isConfigured ? <Badge className="bg-emerald-600">{t('common.configured')}</Badge> : <Badge variant="outline">{t('common.notConfigured')}</Badge> },
    { key: 'active', header: t('common.status'), render: (provider) => provider.isActive ? <Badge className="bg-emerald-600">{t('common.active')}</Badge> : <Badge variant="secondary">{t('common.inactive')}</Badge> },
    { key: 'actions', header: '', className: 'w-[140px] text-right', render: (provider) => <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" disabled={uploading === provider.id} onClick={() => { uploadTarget.current = provider.id; inputRef.current?.click(); }} aria-label={t('admin.uploadAssetFor', { name: provider.name })}>{uploading === provider.id ? <Loader2Icon className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}</Button>
      <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(provider); setDialogMode('edit'); setDialogError(null); setDialogOpen(true); }} aria-label={t('admin.editEntry', { name: provider.name })}><PencilIcon className="size-3.5" /></Button>
      <Button variant="ghost" size="icon-sm" onClick={() => void remove(provider)} aria-label={t('admin.deleteEntry', { name: provider.name })}><Trash2Icon className="size-3.5 text-destructive" /></Button>
    </div> },
  ];

  return <div className="mx-admin-page">
    <div className="mx-admin-pageheader"><div><h1>{t('admin.providersTitle')}</h1><p>{t('admin.providersSubtitle')}</p></div><Button onClick={() => { setEditing(null); setDialogMode('create'); setDialogError(null); setDialogOpen(true); }}><PlusIcon className="mr-1.5 size-4" />{t('admin.addProvider')}</Button></div>
    {error && <div className="mx-admin-alert mx-admin-alert--error">{error}<button className="ml-2 underline" onClick={() => void load()}>{t('common.retry')}</button></div>}
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} />
    <DataTable columns={columns} data={providers} keyExtractor={(provider) => provider.id} loading={loading} emptyMessage={t('admin.noProviders')} />
    <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} mode={dialogMode} title={dialogMode === 'create' ? t('admin.addProvider') : t('common.edit')} fields={fields} onSubmit={save} loading={dialogLoading} error={dialogError} defaultValues={editing ? { providerKey: editing.providerKey, name: editing.name, isActive: String(editing.isActive), websiteUrl: editing.websiteUrl ?? '', shortDescription: editing.shortDescription ?? '', longDescription: editing.longDescription ?? '' } : { isActive: 'true' }} />
  </div>;
}
