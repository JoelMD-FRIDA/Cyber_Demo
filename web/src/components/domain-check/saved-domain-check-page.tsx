"use client";
import { apiFetch } from '@/lib/api-client';

import { AlertTriangle, Download, FileText, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, translateApiError } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DomainCheckProgress } from "./domain-check-progress";
import { DomainCheckStepper } from "./domain-check-stepper";
import { buildViewModel, type DomainCheckAssessment, type SavedDomainCheck, type SavedDomainCheckResponse } from "./saved-domain-check-view-model";

export function SavedDomainCheckPage({ checkId }: { checkId: string }) {
  const [check, setCheck] = useState<SavedDomainCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { locale, t } = useI18n();

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await apiFetch(`/api/domain-check/${checkId}`, { method: "POST", cache: "no-store", headers: { Accept: "application/json" } });
        const payload = await response.json() as SavedDomainCheckResponse & { error?: string; code?: string };
        if (!response.ok || !payload.check) {
          if (!disposed) { setError(translateApiError(locale, payload.code, payload.error ?? t("domain.loadError"))); setLoading(false); }
          return;
        }
        if (disposed) return;
        setCheck(payload.check);
        setError(null);
        setLoading(false);
        if (payload.check.status === "queued" || payload.check.status === "running") timer = setTimeout(() => void load(), 3000);
      } catch {
        if (!disposed) { setError(t("domain.loadError")); setLoading(false); }
      }
    }
    void load();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [checkId, locale, t]);

  const viewModel = useMemo(() => check ? buildViewModel(check) : null, [check]);
  const reportJson = useMemo(() => check ? JSON.stringify(check, null, 2) : "", [check]);
  const downloadReport = useCallback(() => {
    if (!check) return;
    const url = URL.createObjectURL(new Blob([reportJson], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `domain-check-${check.url.replace(/[^a-z0-9.-]/gi, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [check, reportJson]);

  if (loading) return <PageShell><DomainCheckStepper currentStep={2} /><DomainCheckProgress title={t("common.loading")} description={t("domain.processingHint")} /></PageShell>;
  if (error || !check) return <PageShell><StatusCard status="failed" title={t("domain.checkNotFound")} description={error ?? t("domain.loadError")}><Link href="/dashboard/domain-check" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}><RotateCcw className="size-4" />{t("domain.newCheck")}</Link></StatusCard></PageShell>;

  const isProcessing = check.status === "queued" || check.status === "running";
  const statusKey = ["queued", "running", "completed", "partial", "failed"].includes(check.status) ? check.status : "failed";
  const title = t("domain.reportTitle", { url: check.url });
  const date = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(check.createdAt));

  return (
    <PageShell>
      <DomainCheckStepper currentStep={isProcessing ? 2 : 3} />
      <div><p className="text-sm font-semibold text-[var(--stitch-primary)]">{t("domain.title")}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{t("domain.reportSubtitle", { provider: check.provider?.name ?? "—", category: check.category?.name ?? "—", date })}</p></div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant={check.status === "failed" ? "destructive" : "secondary"}>{t(`domain.${statusKey}`)}</Badge><Badge variant="outline">{t("domain.quota", { remaining: check.remainingChecks, maximum: check.maxChecks })}</Badge></div>
      {isProcessing && <DomainCheckProgress check={check} title={check.status === "queued" ? t("domain.queuedTitle") : t("domain.runningTitle")} description={t("domain.processingHint")} />}
      {check.status === "failed" && <StatusCard status="failed" title={t("domain.failed")} description={check.errorMessage ?? t("domain.loadError")} />}
      {!isProcessing && check.status !== "failed" && viewModel && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5"><MetricCard label={t("domain.total")} value={viewModel.summary.totalChecks} /><MetricCard label={t("domain.passed")} value={viewModel.summary.passed} tone="success" /><MetricCard label={t("domain.neutral")} value={viewModel.summary.neutral} /><MetricCard label={t("domain.warnings")} value={viewModel.summary.warnings} tone="warning" /><MetricCard label={t("domain.failedMetric")} value={viewModel.summary.failed} tone="danger" /></div>
        {viewModel.assessment && <CysmoAssessmentCard assessment={viewModel.assessment} />}
        {viewModel.unacknowledgedSubdomains.length > 0 && <Card className="border-amber-300 bg-amber-50/60"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" />{t("domain.providerNotice")}</CardTitle></CardHeader><CardContent><p className="text-sm text-amber-950">{t("domain.unacknowledgedSubdomains", { count: viewModel.unacknowledgedSubdomains.length })}</p><ul className="mt-2 list-disc pl-5 text-sm text-amber-950">{viewModel.unacknowledgedSubdomains.map((domain) => <li key={domain}>{domain}</li>)}</ul></CardContent></Card>}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-[var(--stitch-primary)]" />{t("domain.details")}</CardTitle><CardDescription>{check.provider?.name ?? "—"} · {check.category?.name ?? "—"}</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><ResultBlock label={t("domain.spf")} value={viewModel.hasSpfMeasurement ? (viewModel.hasSpf ? t("domain.spfPresent") : t("domain.spfMissing")) : "—"} detail={viewModel.hasSpfMeasurement ? viewModel.spfDetail ?? t("domain.noFindings") : t("domain.notMeasured")} /><ResultBlock label={t("domain.openPorts")} value={viewModel.portMeasurementCount === null ? "—" : String(viewModel.portMeasurementCount)} detail={viewModel.portMeasurementCount === null ? t("domain.notMeasured") : String(viewModel.portMeasurementCount)} /><ResultBlock label={t("domain.dataLeaks")} value={String(viewModel.structured.resultsPWLeaks + viewModel.structured.resultsEmailLeaks)} detail={viewModel.structured.hasDarknetResults ? t("domain.findings") : t("domain.noFindings")} /><ResultBlock label={t("domain.eolSoftware")} value={viewModel.hasSoftwareMeasurement ? String(viewModel.structured.resultsEoLSoftware) : "—"} detail={viewModel.hasSoftwareMeasurement ? (viewModel.structured.hasSoftwareResults ? t("domain.findings") : t("domain.noFindings")) : t("domain.notMeasured")} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" />{t("domain.findings")}</CardTitle></CardHeader><CardContent className="space-y-3">{viewModel.findings.length === 0 ? <p className="text-sm text-muted-foreground">{viewModel.assessment && viewModel.summary.warnings + viewModel.summary.failed > 0 ? t("domain.classificationOnly") : t("domain.noFindings")}</p> : viewModel.findings.map((finding) => <div key={`${finding.type}-${finding.description}`} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{finding.type}</p><Badge variant={finding.severity === "critical" || finding.severity === "high" ? "destructive" : "outline"}>{finding.severity}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{finding.description}</p><p className="mt-1 text-xs text-muted-foreground">{t("domain.source")}: {finding.source}</p></div>)}</CardContent></Card>
      </>}
      {check.rawResult && <details className="rounded-lg border bg-[var(--frida-surface)] p-4"><summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><FileText className="size-4" />{t("domain.rawDetails")}</summary><pre className="mt-4 max-h-[30rem] overflow-auto rounded-lg bg-[var(--frida-app-background)] p-4 text-xs"><code>{reportJson}</code></pre><button type="button" onClick={downloadReport} className={cn(buttonVariants({ variant: "outline" }), "mt-4")}><Download className="size-4" />{t("domain.download")}</button></details>}
      <Link href="/dashboard/domain-check" className={cn(buttonVariants({ variant: "default" }), "w-fit")}><RotateCcw className="size-4" />{t("domain.newCheck")}</Link>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) { return <main className="frida-content-page"><div className="mx-auto flex max-w-5xl flex-col gap-4 sm:gap-5">{children}</div></main>; }
function StatusCard({ status, title, description, children }: { status: string; title: string; description: string; children?: React.ReactNode }) { return <Card><CardContent className="flex flex-col items-start gap-3 p-6"><div className="flex items-center gap-2">{status === "running" || status === "queued" ? <Loader2 className="size-5 animate-spin text-[var(--stitch-primary)]" /> : <AlertTriangle className="size-5 text-destructive" />}<CardTitle>{title}</CardTitle></div><p className="text-sm text-muted-foreground">{description}</p>{children}</CardContent></Card>; }
function CysmoAssessmentCard({ assessment }: { assessment: DomainCheckAssessment }) {
  const { t } = useI18n();
  const { classifications } = assessment;
  return <Card><CardHeader><CardTitle>{t("domain.cysmoAssessment")}</CardTitle><CardDescription>{t("domain.classification")}</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><ScoreBlock label={t("domain.technicalScore")} score={assessment.technicalScore} ratingLabel={t("domain.rating")} rating={assessment.technicalRating ?? t("domain.noRating")} /><ScoreBlock label={t("domain.businessScore")} score={assessment.businessScore} ratingLabel={t("domain.rating")} rating={assessment.businessRating ?? t("domain.noRating")} /></div><div><p className="mb-3 text-sm font-semibold">{t("domain.classification")}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><ClassificationBlock label={t("domain.passed")} value={classifications.good} tone="success" /><ClassificationBlock label={t("domain.neutral")} value={classifications.neutral} tone="neutral" /><ClassificationBlock label={t("domain.warnings")} value={classifications.warning} tone="warning" /><ClassificationBlock label={t("domain.critical")} value={classifications.critical} tone="danger" /><ClassificationBlock label={t("domain.catastrophic")} value={classifications.catastrophic} tone="danger" /></div></div></CardContent></Card>;
}
function ScoreBlock({ label, score, ratingLabel, rating }: { label: string; score: number | null; ratingLabel: string; rating: string }) { return <div className="rounded-lg border bg-[var(--frida-app-background)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold text-[var(--stitch-primary)]">{formatScore(score)}</p><p className="mt-1 text-xs text-muted-foreground">{ratingLabel}: <span className="font-semibold text-foreground">{rating}</span></p></div>; }
function ClassificationBlock({ label, value, tone }: { label: string; value: number; tone: "success" | "neutral" | "warning" | "danger" }) { const colors = { success: "text-emerald-600", neutral: "text-foreground", warning: "text-amber-600", danger: "text-red-600" }; return <div className="rounded-lg border bg-[var(--frida-app-background)] p-3"><p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={cn("mt-1 text-2xl font-bold", colors[tone])}>{value}</p></div>; }
function formatScore(value: number | null): string { if (value === null) return "—"; const percentage = value <= 1 ? value * 100 : value; return `${percentage.toFixed(1)}%`; }
function MetricCard({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) { const colors = { neutral: "text-foreground", success: "text-emerald-600", warning: "text-amber-600", danger: "text-red-600" }; return <ResultBlock label={label} value={String(value)} detail="" valueClassName={colors[tone]} />; }
function ResultBlock({ label, value, detail, valueClassName }: { label: string; value: string; detail: string; valueClassName?: string }) { return <Card size="sm"><CardContent><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={cn("mt-2 text-2xl font-bold", valueClassName)}>{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>; }
