"use client";

import { AlertTriangle, ArrowLeft, FileText, RotateCcw, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DomainCheckStepIndicator } from './domain-check-step-indicator';
import { SavedDomainCheckReportJson } from './saved-domain-check-report-json';
import { buildViewModel, type SavedDomainCheck, type SavedDomainCheckResponse, type SavedView } from './saved-domain-check-view-model';

interface SavedDomainCheckPageProps {
  checkId: string;
  view: SavedView;
}

const statusLabels: Record<string, string> = {
  completed: 'Abgeschlossen',
  partial: 'Teilweise abgeschlossen',
  failed: 'Fehlgeschlagen',
};

export function SavedDomainCheckPage({ checkId, view }: SavedDomainCheckPageProps) {
  const [check, setCheck] = useState<SavedDomainCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentStep = view === 'report' ? 3 : 2;

  useEffect(() => {
    const controller = new AbortController();

    async function loadCheck() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/domain-check/${checkId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          setError(response.redirected ? 'Deine Sitzung ist abgelaufen. Melde dich erneut an, um diesen Bericht anzusehen.' : 'Der Server hat keine gültige Domain-Check-Antwort zurückgegeben.');
          return;
        }

        const payload: SavedDomainCheckResponse & { error?: string } = await response.json();

        if (!response.ok) {
          setError(payload.error ?? 'Der Domain-Check konnte nicht geladen werden.');
          return;
        }

        if (!payload.check) {
          setError('Der gespeicherte Domain-Check wurde nicht gefunden.');
          return;
        }

        setCheck(payload.check);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError('Der Domain-Check konnte nicht geladen werden. Bitte versuche es erneut.');
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
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(check.createdAt));
  }, [check]);

  const viewModel = useMemo(() => check ? buildViewModel(check) : null, [check]);
  const reportJson = useMemo(() => check ? JSON.stringify({ generatedAt: new Date(check.createdAt).toISOString(), check }, null, 2) : '', [check]);

  const downloadReport = useCallback(() => {
    if (!check || !reportJson) {
      return;
    }

    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `domain-check-${check.url.replace(/[^a-z0-9.-]/gi, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [check, reportJson]);

  if (loading) {
    return <PageShell title="Domain-Check wird geladen" description="Der gespeicherte Scan wird geladen." currentStep={currentStep} />;
  }

  if (error || !check) {
    return (
      <PageShell title="Domain-Check nicht gefunden" description={error ?? 'Dieser Scan existiert nicht oder gehört nicht zu deinem Konto.'} currentStep={currentStep}>
        <Link href="/dashboard/domain-check" className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}>
          <RotateCcw className="size-4" />
          Neuen Scan starten
        </Link>
      </PageShell>
    );
  }

  const safeViewModel = viewModel;
  if (!safeViewModel) {
    return <PageShell title="Domain-Check nicht gefunden" description="Dieser Scan konnte nicht verarbeitet werden." currentStep={currentStep} />;
  }

  const reportPage = view === 'report';

  return (
    <PageShell
      title={reportPage ? `Sicherheitsbericht für ${check.url}` : `Scan-Ergebnisse für ${check.url}`}
      description={`${check.providerName} · ${check.categoryName} · ${generatedAt}`}
      currentStep={currentStep}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={check.status === 'failed' ? 'destructive' : 'secondary'}>
          {statusLabels[check.status] ?? check.status}
        </Badge>
        <Badge variant="outline">{check.remainingChecks}/{check.maxChecks} Checks übrig</Badge>
      </div>

      {reportPage ? (
        <SavedDomainCheckReportJson reportJson={reportJson} onDownload={downloadReport} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Gesamt" value={safeViewModel.summary.totalChecks} />
            <MetricCard label="Bestanden" value={safeViewModel.summary.passed} tone="success" />
            <MetricCard label="Warnungen" value={safeViewModel.summary.warnings} tone="warning" />
            <MetricCard label="Fehlgeschlagen" value={safeViewModel.summary.failed} tone="danger" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[var(--stitch-primary)]" />
                Technische Ergebnisse
              </CardTitle>
              <CardDescription>Gespeicherte Scan-Ergebnisse für SPF, Ports, Leaks und Cysmo-Indikatoren.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ResultBlock label="SPF-Eintrag" value={safeViewModel.hasSpf ? 'Vorhanden' : 'Nicht gefunden'} detail={safeViewModel.spfDetail} />
              <ResultBlock label="Offene Ports" value={String(check.structuredResults.resultsOpenPorts)} detail={`${safeViewModel.portMeasurementCount} Port-Messungen gespeichert`} />
              <ResultBlock label="Datenlecks" value={String(check.structuredResults.resultsPWLeaks + check.structuredResults.resultsEmailLeaks)} detail={`${safeViewModel.findings.length} Befunde gespeichert`} />
              <ResultBlock label="EOL-Software" value={String(check.structuredResults.resultsEoLSoftware)} detail={check.structuredResults.hasSoftwareResults ? 'Softwareprüfung verfügbar' : 'Keine Softwarebefunde'} />
            </CardContent>
          </Card>

          {safeViewModel.findings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  Befunde
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
                    <p className="mt-1 text-xs text-[var(--stitch-on-surface-variant)]">Quelle: {finding.source}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/domain-check" className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}>
          <RotateCcw className="size-4" />
          Neuer Scan
        </Link>
        <Link href={`/dashboard/domain-check/${reportPage ? 'results' : 'report'}/${check.id}`} className={cn(buttonVariants({ variant: 'default' }), 'w-fit')}>
          {reportPage ? <ArrowLeft className="size-4" /> : <FileText className="size-4" />}
          {reportPage ? 'Zurück zu den Ergebnissen' : 'Bericht ansehen'}
        </Link>
      </div>
    </PageShell>
  );
}

function PageShell({ title, description, currentStep, children }: { title: string; description: string; currentStep: 2 | 3; children?: ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-var(--frida-topbar-height))] bg-[var(--frida-app-background)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <DomainCheckStepIndicator currentStep={currentStep} />
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

  return <ResultBlock label={label} value={String(value)} detail="Zusammenfassung" valueClassName={toneClass} />;
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
