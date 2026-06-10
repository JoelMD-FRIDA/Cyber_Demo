"use client";

import { useWizard } from "@/components/domain-check/wizard-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  DownloadIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  NetworkIcon,
  BugIcon,
  FileTextIcon,
  ClockIcon,
  GlobeIcon,
  HashIcon,
  DatabaseIcon,
  EyeIcon,
  MailIcon,
  ServerIcon,
  UserCheckIcon,
} from "lucide-react";

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

function severityScore(severity: "low" | "medium" | "high" | "critical"): number {
  switch (severity) {
    case "low": return 1;
    case "medium": return 2;
    case "high": return 3;
    case "critical": return 4;
  }
}

export default function Step3Report() {
  const { state, resetWizard } = useWizard();

  if (!state.results || !state.checkId) {
    return null;
  }

  const { results } = state;

  const reportData = {
    generatedAt: new Date().toISOString(),
    url: state.url,
    checkId: state.checkId,
    summary: results.summary,
    spf: results.spf,
    ports: results.ports,
    leaks: results.leaks,
  };

  function downloadJson() {
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domain-check-${state.checkId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Report Header */}
      <Card size="sm" className={transparentCardClass}>
        <CardHeader className="px-0 text-center">
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-col items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-[var(--frida-primary)] text-white">
                <FileTextIcon className="size-6" />
              </span>
              <p className="text-[var(--frida-font-size-large)] font-bold text-[var(--frida-primary)]">
                Ergebnis
              </p>
              <CardTitle className="text-[var(--frida-font-size-h1)] font-semibold leading-tight text-[var(--frida-header-text)]">
                Deine Sicherheitsprüfung für {state.url}
              </CardTitle>
            </div>
            <Badge variant="secondary" className="gap-1">
              <HashIcon className="size-3" />
              #{state.checkId}
            </Badge>
          </div>
          <CardDescription className="mx-auto max-w-2xl text-[14px] text-[var(--muted-foreground)]">
            Folgende Risiken wurden entdeckt von{" "}
            <span className="font-semibold text-[var(--frida-header-text)]">
              {state.providers.find((p) => p.id === state.providerId)?.name ??
                "N/A"}
            </span>
            . Die Resultate bleiben als Bericht und Download erreichbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3" />
              Generated: {new Date().toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <GlobeIcon className="size-3" />
              {state.providers.find((p) => p.id === state.providerId)?.name ??
                "N/A"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
          <CardContent className="py-4">
            <p className="text-3xl font-bold text-[var(--frida-header-text)]">
              {results.summary.totalChecks}
            </p>
            <p className="text-xs text-muted-foreground">Total Checks</p>
          </CardContent>
        </Card>
        <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
          <CardContent className="py-4">
            <p className="text-3xl font-bold text-[var(--frida-primary)]">
              {results.summary.passed}
            </p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </CardContent>
        </Card>
        <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
          <CardContent className="py-4">
            <p className="text-3xl font-bold text-[var(--frida-gradient-start)]">
              {results.summary.warnings}
            </p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
        <Card size="sm" className={`items-center text-center ${metricCardClass}`}>
          <CardContent className="py-4">
            <p className="text-3xl font-bold text-destructive">
              {results.summary.failed}
            </p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* SPF Section */}
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
            {results.spf.hasSpf ? (
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
          {results.spf.spfRecord && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">
                DNS Record:
              </span>
              <pre className="overflow-x-auto rounded-[var(--frida-radius-default)] bg-[var(--frida-app-background)] p-3 text-xs leading-relaxed">
                {results.spf.spfRecord}
              </pre>
            </div>
          )}
          {results.spf.issues.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                Issues
              </span>
              <ul className="space-y-1">
                {results.spf.issues.map((issue, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-[var(--frida-radius-default)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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

      {/* Ports Section */}
      <Card size="sm" className={sectionCardClass}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <NetworkIcon className="size-5 text-[var(--frida-primary)]" />
            <CardTitle>Port Scan Results</CardTitle>
          </div>
          <CardDescription>
            Scanned {results.ports.length} port
            {results.ports.length !== 1 ? "s" : ""}
          </CardDescription>
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
              {results.ports.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No port data available
                  </TableCell>
                </TableRow>
              ) : (
                results.ports.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono font-medium">
                      {p.port}
                    </TableCell>
                    <TableCell>{p.service}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "open"
                            ? "destructive"
                            : p.status === "closed"
                              ? "default"
                              : "secondary"
                        }
                        className="gap-1"
                      >
                        {p.status === "open" && (
                          <XCircleIcon className="size-3" />
                        )}
                        {p.status === "closed" && (
                          <CheckCircle2Icon className="size-3" />
                        )}
                        {p.status === "filtered" && (
                          <AlertTriangleIcon className="size-3" />
                        )}
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Leaks Section */}
      <Card size="sm" className={sectionCardClass}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BugIcon className="size-5 text-[var(--frida-primary)]" />
            <CardTitle>Leaks &amp; Vulnerabilities</CardTitle>
          </div>
          <CardDescription>
            {results.leaks.length === 0
              ? "No issues detected."
              : `${results.leaks.length} issue${results.leaks.length !== 1 ? "s" : ""} found with ${
                  results.leaks.filter(
                    (l) => l.severity === "high" || l.severity === "critical",
                  ).length
                } critical/high severity`}
          </CardDescription>
        </CardHeader>
        {results.leaks.length > 0 ? (
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
                {results.leaks
                  .sort(
                    (a, b) =>
                      severityScore(b.severity) - severityScore(a.severity),
                  )
                  .map((leak, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {leak.type}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            leak.severity === "critical"
                              ? "destructive"
                              : leak.severity === "high"
                                ? "destructive"
                                : leak.severity === "medium"
                                  ? "default"
                                  : "secondary"
                          }
                        >
                          {leak.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        {leak.description}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs">
                        {leak.source}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2Icon className="size-5 text-[var(--frida-primary)]" />
              <span>All clear — no leaks or vulnerabilities detected</span>
            </div>
          </CardContent>
        )}
        {results.leaks.length > 0 && (
          <CardFooter className="flex-col items-stretch gap-2">
            <p className="text-xs text-muted-foreground">
              {results.leaks.filter((l) => l.severity === "critical").length > 0 && (
                <span className="text-destructive">
                  ⚠ Critical issues require immediate attention.{" "}
                </span>
              )}
              Review each finding and take appropriate remediation steps.
            </p>
          </CardFooter>
        )}
      </Card>

      {state.structuredResults && (
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
                <p className={`text-xl font-bold ${state.structuredResults.resultsPWLeaks > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
                  {state.structuredResults.resultsPWLeaks}
                </p>
              </div>
              <div className={`space-y-1 p-3 ${insetPanelClass}`}>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MailIcon className="size-3.5" />
                  <span>Email Leaks</span>
                </div>
                <p className={`text-xl font-bold ${state.structuredResults.resultsEmailLeaks > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
                  {state.structuredResults.resultsEmailLeaks}
                </p>
              </div>
              <div className={`space-y-1 p-3 ${insetPanelClass}`}>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ServerIcon className="size-3.5" />
                  <span>EoL Software</span>
                </div>
                <p className={`text-xl font-bold ${state.structuredResults.resultsEoLSoftware > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
                  {state.structuredResults.resultsEoLSoftware}
                </p>
              </div>
              <div className={`space-y-1 p-3 ${insetPanelClass}`}>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <NetworkIcon className="size-3.5" />
                  <span>Open Ports</span>
                </div>
                <p className={`text-xl font-bold ${state.structuredResults.resultsOpenPorts > 0 ? "text-destructive" : "text-[var(--frida-primary)]"}`}>
                  {state.structuredResults.resultsOpenPorts}
                </p>
              </div>
              <div className={`space-y-1 p-3 ${insetPanelClass}`}>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShieldCheckIcon className="size-3.5" />
                  <span>SPF Record</span>
                </div>
                <div className="flex items-center gap-2">
                  {state.structuredResults.resultsSPFRecord ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle2Icon className="mr-1 size-3" />
                      Present
                    </Badge>
                  ) : (
                    <Badge variant={state.structuredResults.hasSPFRecordResult ? "destructive" : "secondary"} className="text-xs">
                      {state.structuredResults.hasSPFRecordResult ? (
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
                  {state.structuredResults.hasDarknetResults ? (
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
              <span>Software Results: {state.structuredResults.hasSoftwareResults ? "Found" : "None"}</span>
              <span>Open Ports Results: {state.structuredResults.hasOpenPortsResults ? "Found" : "None"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {state.remainingChecks !== null && state.maxChecks !== null && (
        <div className="flex items-center justify-center gap-2 rounded-[var(--frida-radius-default)] border border-[var(--frida-input-border)] bg-[var(--frida-surface)] px-3 py-2 text-xs text-[var(--muted-foreground)] shadow-[var(--frida-input-shadow)]">
          <span>
            Remaining checks: <strong>{state.remainingChecks}/{state.maxChecks}</strong>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={resetWizard} className={`gap-2 ${outlineButtonClass}`}>
          <RotateCcwIcon className="size-4" />
          Check Another Domain
        </Button>
        <Button onClick={downloadJson} className={`gap-2 ${primaryButtonClass}`}>
          <DownloadIcon className="size-4" />
          Download JSON Report
        </Button>
      </div>
    </div>
  );
}
