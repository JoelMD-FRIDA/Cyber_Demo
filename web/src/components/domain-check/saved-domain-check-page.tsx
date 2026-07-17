"use client";

import { AlertTriangle, ArrowLeft, Download, FileText, RotateCcw, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buildViewModel, type SavedDomainCheck, type SavedDomainCheckResponse, type SavedView } from './saved-domain-check-view-model';

interface SavedDomainCheckPageProps {
  checkId: string;
  view: SavedView;
}

const statusLabels: Record<string, string> = {
  completed: 'Afgerond',
  partial: 'Gedeeltelijk',
  failed: 'Mislukt',
};

export function SavedDomainCheckPage({ checkId, view }: SavedDomainCheckPageProps) {
  const [check, setCheck] = useState<SavedDomainCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCheck() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/domain-check/${checkId}`, {
          signal: controller.signal,
        });
        const payload: SavedDomainCheckResponse & { error?: string } = await response.json();

        if (!response.ok) {
          setError(payload.error ?? 'Kon de domeincheck niet laden.');
          return;
        }

        setCheck(payload.check);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError('Kon de domeincheck niet laden. Probeer het opnieuw.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCheck();

    return () => controller.abort();
  }, [checkId]);

  const generatedAt = useMemo(() => {
    if (!check) {
      return '';
    }
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(check.createdAt));
  }, [check]);

  const viewModel = useMemo(() => check ? buildViewModel(check) : null, [check]);

  const downloadReport = useCallback(() => {
    if (!check) {
      return;
    }

    const report = JSON.stringify({ generatedAt: new Date().toISOString(), check }, null, 2);
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `domain-check-${check.url.replace(/[^a-z0-9.-]/gi, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [check]);

  if (loading) {
    return <PageShell title="Domeincheck laden" description="We halen de opgeslagen scan op." />;
  }

  if (error || !check) {
    return (
      <PageShell title="Domeincheck niet gevonden" description={error ?? 'Deze scan bestaat niet of is niet van jouw account.'}>
        <Link href="/dashboard/domain-check" className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}>
          <RotateCcw className="size-4" />
          Nieuwe scan starten
        </Link>
      </PageShell>
    );
  }

  const safeViewModel = viewModel;
  if (!safeViewModel) {
    return <PageShell title="Domeincheck niet gevonden" description="Deze scan kon niet worden verwerkt." />;
  }

  const reportPage = view === 'report';

  return (
    <PageShell
      title={reportPage ? `Sicherheitsbericht voor ${check.url}` : `Scan-Ergebnisse voor ${check.url}`}
      description={`${check.providerName} · ${check.categoryName} · ${generatedAt}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={check.status === 'failed' ? 'destructive' : 'secondary'}>
          {statusLabels[check.status] ?? check.status}
        </Badge>
        <Badge variant="outline">{check.remainingChecks}/{check.maxChecks} checks over</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Totaal" value={safeViewModel.summary.totalChecks} />
        <MetricCard label="Geslaagd" value={safeViewModel.summary.passed} tone="success" />
        <MetricCard label="Waarschuwingen" value={safeViewModel.summary.warnings} tone="warning" />
        <MetricCard label="Mislukt" value={safeViewModel.summary.failed} tone="danger" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--stitch-primary)]" />
            Technische resultaten
          </CardTitle>
          <CardDescription>Persistente scanresultaten voor SPF, poorten, lekken en Cysmo-indicatoren.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ResultBlock label="SPF-record" value={safeViewModel.hasSpf ? 'Aanwezig' : 'Niet gevonden'} detail={safeViewModel.spfDetail} />
          <ResultBlock label="Open poorten" value={String(check.structuredResults.resultsOpenPorts)} detail={`${safeViewModel.portMeasurementCount} poortmetingen opgeslagen`} />
          <ResultBlock label="Datalekken" value={String(check.structuredResults.resultsPWLeaks + check.structuredResults.resultsEmailLeaks)} detail={`${safeViewModel.findings.length} bevindingen opgeslagen`} />
          <ResultBlock label="EOL software" value={String(check.structuredResults.resultsEoLSoftware)} detail={check.structuredResults.hasSoftwareResults ? 'Softwarecontrole beschikbaar' : 'Geen softwarebevindingen'} />
        </CardContent>
      </Card>

      {safeViewModel.findings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Bevindingen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {safeViewModel.findings.map((finding) => (
              <div key={`${finding.type}-${finding.source}-${finding.description}`} className="rounded-[var(--stitch-card-radius)] border border-[var(--stitch-outline-variant)] bg-[var(--stitch-surface-container-low)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--stitch-on-surface)]">{finding.type}</p>
                  <Badge variant={finding.severity === 'critical' || finding.severity === 'high' ? 'destructive' : 'outline'}>{finding.severity}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--stitch-on-surface-variant)]">{finding.description}</p>
                <p className="mt-1 text-xs text-[var(--stitch-on-surface-variant)]">Bron: {finding.source}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {reportPage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[var(--stitch-primary)]" />
              Rapport export
            </CardTitle>
            <CardDescription>Download het volledige opgeslagen JSON-rapport voor archivering of opvolging.</CardDescription>
          </CardHeader>
          <CardContent>
            <button type="button" onClick={downloadReport} className={cn(buttonVariants({ variant: 'default' }), 'w-fit')}>
              <Download className="size-4" />
              Rapport downloaden
            </button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/domain-check" className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}>
          <RotateCcw className="size-4" />
          Nieuwe scan
        </Link>
        <Link href={`/dashboard/domain-check/${reportPage ? 'results' : 'report'}/${check.id}`} className={cn(buttonVariants({ variant: 'default' }), 'w-fit')}>
          {reportPage ? <ArrowLeft className="size-4" /> : <FileText className="size-4" />}
          {reportPage ? 'Terug naar resultaten' : 'Bekijk rapport'}
        </Link>
      </div>
    </PageShell>
  );
}

function PageShell({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-var(--frida-topbar-height))] bg-[var(--frida-app-background)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div>
          <p className="text-sm font-semibold text-[var(--stitch-primary)]">Domain Check</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--stitch-on-surface)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--stitch-on-surface-variant)]">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

function MetricCard({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    neutral: 'text-[var(--stitch-on-surface)]',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }[tone];

  return <ResultBlock label={label} value={String(value)} detail="Samenvatting" valueClassName={toneClass} />;
}

function ResultBlock({ label, value, detail, valueClassName }: { label: string; value: string; detail: string; valueClassName?: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--stitch-on-surface-variant)]">{label}</p>
        <p className={cn('mt-2 text-2xl font-bold text-[var(--stitch-on-surface)]', valueClassName)}>{value}</p>
        <p className="mt-1 text-xs text-[var(--stitch-on-surface-variant)]">{detail}</p>
      </CardContent>
    </Card>
  );
}
