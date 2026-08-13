'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityIcon, Building2Icon, FolderTreeIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';
import { getApiErrorMessage, useI18n } from '@/lib/i18n';

type Stats = {
  totalUsers: number;
  totalProviders: number;
  totalCategories: number;
  totalChecks: number;
  queuedChecks: number;
  runningChecks: number;
  completedChecks: number;
  failedChecks: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { locale, t } = useI18n();

  useEffect(() => {
    fetch('/api/admin/summary')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t('common.retry')));
        setStats(data.stats);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t('common.retry')));
  }, [locale, t]);

  const cards = [
    [t('admin.users'), stats?.totalUsers, UsersIcon],
    [t('admin.providers'), stats?.totalProviders, Building2Icon],
    [t('admin.categories'), stats?.totalCategories, FolderTreeIcon],
    [t('admin.checks'), stats?.totalChecks, ShieldCheckIcon],
  ] as const;

  return <div className="mx-admin-page">
    <div className="mx-admin-pageheader"><div><h1>{t('admin.dashboardTitle')}</h1><p>{t('admin.dashboardSubtitle')}</p></div></div>
    {error && <div className="mx-admin-alert mx-admin-alert--error">{error}</div>}
    <div className="mb-6 rounded-[var(--stitch-card-radius)] bg-[image:var(--frida-gradient-background)] p-5 text-white shadow-[var(--stitch-shadow-card)]">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[var(--frida-radius-default)] bg-white/14 text-[var(--frida-logo-accent)]"><ActivityIcon className="size-5" /></span><div><p className="font-semibold">{t('admin.checks')}</p><p className="text-sm text-white/75">{stats ? `${stats.queuedChecks} ${t('admin.queued')} · ${stats.runningChecks} ${t('admin.running')} · ${stats.failedChecks} ${t('admin.failed')}` : t('common.loading')}</p></div></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value, Icon]) => <Card key={label}><CardHeader><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Icon className="size-4" />{label}</CardTitle></CardHeader><CardContent>{value === undefined ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-[var(--frida-header-text)]">{value}</p>}</CardContent></Card>)}
    </div>
  </div>;
}
