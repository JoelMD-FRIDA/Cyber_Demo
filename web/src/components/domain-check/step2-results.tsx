"use client";

import { useWizard } from "@/components/domain-check/wizard-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ShieldCheckIcon,
  ShieldXIcon,
  NetworkIcon,
  BugIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  ArrowRightIcon,
  RefreshCwIcon,
  DatabaseIcon,
  EyeIcon,
  MailIcon,
  ServerIcon,
  UserCheckIcon,
} from "lucide-react";
import type { StructuredResults } from "./wizard-context";

const transparentCardClass =
  "rounded-[var(--frida-card-transparent-radius)] border border-[var(--frida-transparent-card-border-color)] bg-[var(--frida-surface)] p-6 text-[var(--frida-header-text)] shadow-none ring-0 sm:p-8";

const sectionCardClass =
  "rounded-[var(--frida-card-radius)] border border-[var(--frida-border-default)] bg-[var(--frida-surface)] shadow-none ring-0";

const metricCardClass =
  "rounded-[var(--frida-card-radius)] border border-[var(--frida-border-default)] bg-[var(--frida-surface)] shadow-none ring-0";

const insetPanelClass =
  "rounded-[var(--frida-radius-default)] border border-[var(--frida-input-border)] bg-[var(--frida-app-background)] shadow-none";

const primaryButtonClass =
  "h-11 rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] px-6 text-[14px] font-semibold text-white shadow-none hover:bg-[var(--frida-gradient-start)] focus-visible:border-[var(--frida-primary)] focus-visible:ring-2 focus-visible:ring-[var(--frida-primary)]";

const outlineButtonClass =
  "h-11 rounded-[var(--frida-radius-default)] border-[var(--frida-primary)] bg-[var(--frida-surface)] px-6 text-[14px] font-semibold text-[var(--frida-primary)] shadow-none hover:bg-[var(--frida-muted-surface)] hover:text-[var(--frida-gradient-start)]";

function StatusBadge({ status }: { status: "open" | "closed" | "filtered" }) {
  const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    open: "destructive",
    closed: "default",
    filtered: "secondary",
  };
  const icons = {
    open: XCircleIcon,
    closed: CheckCircle2Icon,
    filtered: AlertTriangleIcon,
  };
  const Icon = icons[status];
  return (
    <Badge variant={variants[status]}>
      <Icon className="mr-1 size-3" />
      {status}
    </Badge>
  );
}

function SeverityBadge({
  severity,
}: {
  severity: "low" | "medium" | "high" | "critical";
}) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    low: "secondary",
    medium: "default",
    high: "destructive",
    critical: "destructive",
  };
  return <Badge variant={variants[severity]}>{severity}</Badge>;
}

function LoadingSkeleton() {
  return (
    <div className={`mx-auto w-full max-w-3xl space-y-6 ${transparentCardClass}`}>
      <div className="flex items-center justify-center gap-3 py-8">
        <Loader2Icon className="size-6 animate-spin text-[var(--frida-primary)]" />
        <p className="text-sm text-[var(--muted-foreground)]">
          Running domain check...
        </p>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full rounded-[var(--frida-radius-default)]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-32 w-full rounded-[var(--frida-radius-default)]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-32 w-full rounded-[var(--frida-radius-default)]" />
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card size="sm" className={`mx-auto max-w-xl border-destructive/30 ${transparentCardClass}`}>
      <CardHeader className="px-0">
        <div className="flex items-center gap-2">
          <ShieldXIcon className="size-5 text-destructive" />
          <CardTitle>Check Failed</CardTitle>
        </div>
        <CardDescription>
          An error occurred while running the domain check.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="rounded-[var(--frida-radius-default)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </div>
      </CardContent>
      <CardFooter className="border-0 bg-transparent px-0 pt-4 pb-0">
        <Button onClick={onRetry} className={`w-full ${outlineButtonClass}`} variant="outline">
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      </CardFooter>
    </Card>
  );
}

function SpfSection({
  spf,
}: {
  spf: {
    hasSpf: boolean;
    spfRecord: string | null;
    issues: string[];
  };
}) {
  return (
    <Card size="sm" className={sectionCardClass}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5 text-[var(--frida-primary)]" />
          <CardTitle>SPF Record</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          {spf.hasSpf ? (
            <Badge variant="default">
              <CheckCircle2Icon className="mr-1 size-3" />
              Present
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircleIcon className="mr-1 size-3" />
              Missing
            </Badge>
          )}
        </div>
        {spf.spfRecord && (
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Record:</span>
            <code className="block break-all rounded-[var(--frida-radius-default)] bg-[var(--frida-app-background)] px-3 py-2 text-xs">
              {spf.spfRecord}
            </code>
          </div>
        )}
        {spf.issues.length > 0 && (
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Issues:</span>
            <ul className="space-y-1">
              {spf.issues.map((issue, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-destructive"
                >
                  <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PortsSection({
  ports,
}: {
  ports: { port: number; service: string; status: "open" | "closed" | "filtered" }[];
}) {
  return (
    <Card size="sm" className={sectionCardClass}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <NetworkIcon className="size-5 text-[var(--frida-primary)]" />
          <CardTitle>Port Scan</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Port</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ports.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-6 text-center text-muted-foreground"
                >
                  No port data available
                </TableCell>
              </TableRow>
            ) : (
              ports.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{p.port}</TableCell>
                  <TableCell>{p.service}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LeaksSection({
  leaks,
}: {
  leaks: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    source: string;
  }[];
}) {
  return (
    <Card size="sm" className={sectionCardClass}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BugIcon className="size-5 text-[var(--frida-primary)]" />
          <CardTitle>Leaks / Vulnerabilities</CardTitle>
        </div>
        <CardDescription>
          {leaks.length === 0
            ? "No leaks or vulnerabilities detected."
            : `${leaks.length} issue${leaks.length !== 1 ? "s" : ""} found`}
        </CardDescription>
      </CardHeader>
      {leaks.length > 0 && (
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaks.map((leak, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{leak.type}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={leak.severity} />
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal">
                    {leak.description}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {leak.source}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

function SummaryBar({
  summary,
}: {
  summary: { totalChecks: number; passed: number; warnings: number; failed: number };
}) {
  const passedPct =
    summary.totalChecks > 0
      ? Math.round((summary.passed / summary.totalChecks) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
        <CardContent className="py-3">
          <p className="text-2xl font-bold text-[var(--frida-header-text)]">
            {summary.totalChecks}
          </p>
          <p className="text-xs text-muted-foreground">Total Checks</p>
        </CardContent>
      </Card>
      <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
        <CardContent className="py-3">
          <p className="text-2xl font-bold text-[var(--frida-primary)]">
            {summary.passed}
          </p>
          <p className="text-xs text-muted-foreground">Passed</p>
        </CardContent>
      </Card>
      <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
        <CardContent className="py-3">
          <p className="text-2xl font-bold text-[var(--frida-gradient-start)]">
            {summary.warnings}
          </p>
          <p className="text-xs text-muted-foreground">Warnings</p>
        </CardContent>
      </Card>
      <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
        <CardContent className="py-3">
          <p className="text-2xl font-bold text-destructive">
            {summary.failed}
          </p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </CardContent>
      </Card>
      <div className="col-span-full">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--frida-muted-surface)]">
          <div
            className="h-full rounded-full bg-[var(--frida-primary)] transition-all"
            style={{ width: `${passedPct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {passedPct}% pass rate
        </p>
      </div>
    </div>
  );
}

function StructuredResultsSection({
  structured,
}: {
  structured: StructuredResults;
}) {
  return (
    <Card size="sm" className={sectionCardClass}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DatabaseIcon className="size-5 text-[var(--frida-primary)]" />
          <CardTitle>Detailed Analysis</CardTitle>
        </div>
        <CardDescription>
          Structured scan results from domain security analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className={`space-y-1 p-3 ${insetPanelClass}`}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <EyeIcon className="size-3.5" />
              <span>Password Leaks</span>
            </div>
            <p className={`text-xl font-bold ${structured.resultsPWLeaks > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
              {structured.resultsPWLeaks}
            </p>
          </div>

          <div className={`space-y-1 p-3 ${insetPanelClass}`}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MailIcon className="size-3.5" />
              <span>Email Leaks</span>
            </div>
            <p className={`text-xl font-bold ${structured.resultsEmailLeaks > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
              {structured.resultsEmailLeaks}
            </p>
          </div>

          <div className={`space-y-1 p-3 ${insetPanelClass}`}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ServerIcon className="size-3.5" />
              <span>EoL Software</span>
            </div>
            <p className={`text-xl font-bold ${structured.resultsEoLSoftware > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
              {structured.resultsEoLSoftware}
            </p>
          </div>

          <div className={`space-y-1 p-3 ${insetPanelClass}`}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <NetworkIcon className="size-3.5" />
              <span>Open Ports</span>
            </div>
            <p className={`text-xl font-bold ${structured.resultsOpenPorts > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
              {structured.resultsOpenPorts}
            </p>
          </div>

          <div className={`space-y-1 p-3 ${insetPanelClass}`}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheckIcon className="size-3.5" />
              <span>SPF Record</span>
            </div>
            <div className="flex items-center gap-2">
              {structured.resultsSPFRecord ? (
                <Badge variant="default" className="text-xs">
                  <CheckCircle2Icon className="mr-1 size-3" />
                  Present
                </Badge>
              ) : (
                <Badge variant={structured.hasSPFRecordResult ? "destructive" : "secondary"} className="text-xs">
                  {structured.hasSPFRecordResult ? (
                    <><XCircleIcon className="mr-1 size-3" /> Missing</>
                  ) : (
                    <><AlertTriangleIcon className="mr-1 size-3" /> No Data</>
                  )}
                </Badge>
              )}
            </div>
          </div>

          <div className={`space-y-1 p-3 ${insetPanelClass}`}>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserCheckIcon className="size-3.5" />
              <span>Darknet</span>
            </div>
            <div className="flex items-center gap-2">
              {structured.hasDarknetResults ? (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangleIcon className="mr-1 size-3" />
                  Found
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2Icon className="mr-1 size-3" />
                  Clean
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Software Results: {structured.hasSoftwareResults ? "Found" : "None"}</span>
          <span>Open Ports Results: {structured.hasOpenPortsResults ? "Found" : "None"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Step2Results() {
  const { state, runDomainCheck, dispatch } = useWizard();

  if (state.loading) {
    return <LoadingSkeleton />;
  }

  if (state.error) {
    return <ErrorState message={state.error} onRetry={runDomainCheck} />;
  }

  if (!state.results) {
    return null;
  }

  const { results, structuredResults, remainingChecks, maxChecks } = state;
  const providerName =
    state.providers.find((provider) => provider.id === state.providerId)?.name ??
    "N/A";
  const categoryName =
    state.categories.find((category) => category.id === state.categoryId)?.name ??
    "N/A";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card size="sm" className={transparentCardClass}>
        <CardHeader className="px-0 text-center">
          <span className="text-[var(--frida-font-size-large)] font-bold text-[var(--frida-primary)]">
            Step 2/2
          </span>
          <CardTitle className="text-[var(--frida-font-size-h2)] font-semibold leading-tight text-[var(--frida-header-text)]">
            Scan-Ergebnisse für {state.url}
          </CardTitle>
          <CardDescription className="mx-auto max-w-2xl text-[14px] text-[var(--muted-foreground)]">
            Folgende Resultate wurden mit deiner gewählten Scan-Konfiguration
            ermittelt.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-0 pt-2 sm:grid-cols-3">
          <div className={insetPanelClass + " p-3"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Anbieter
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--frida-header-text)]">
              {providerName}
            </p>
          </div>
          <div className={insetPanelClass + " p-3"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Kategorie
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--frida-header-text)]">
              {categoryName}
            </p>
          </div>
          <div className={insetPanelClass + " p-3"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Verbleibende Scans
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--frida-header-text)]">
              {remainingChecks !== null && maxChecks !== null
                ? `${remainingChecks}/${maxChecks}`
                : "N/A"}
            </p>
          </div>
        </CardContent>
      </Card>

      <SummaryBar summary={results.summary} />

      <SpfSection spf={results.spf} />
      <PortsSection ports={results.ports} />
      <LeaksSection leaks={results.leaks} />

      {structuredResults && (
        <StructuredResultsSection structured={structuredResults} />
      )}

      {remainingChecks !== null && maxChecks !== null && (
        <div className="flex items-center justify-center gap-2 rounded-[var(--frida-radius-default)] border border-[var(--frida-input-border)] bg-[var(--frida-surface)] px-3 py-2 text-xs text-[var(--muted-foreground)] shadow-[var(--frida-input-shadow)]">
          <span>
            Remaining checks: <strong>{remainingChecks}/{maxChecks}</strong>
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => dispatch({ type: "SET_STEP", payload: 3 })}
          className={`gap-2 ${primaryButtonClass}`}
        >
          Continue to Report
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
