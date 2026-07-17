import type { StructuredResults } from './wizard-context';

export type SavedView = 'results' | 'report';

export interface SavedDomainCheck {
  id: string;
  url: string;
  status: string;
  providerName: string;
  categoryName: string;
  createdAt: string;
  remainingChecks: number;
  maxChecks: number;
  providerCount: number;
  results: Record<string, unknown>;
  structuredResults: StructuredResults;
}

export interface SavedDomainCheckResponse {
  check: SavedDomainCheck;
}

export interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
}

interface SummaryMetrics {
  totalChecks: number;
  passed: number;
  warnings: number;
  failed: number;
}

export function buildViewModel(check: SavedDomainCheck): {
  summary: SummaryMetrics;
  hasSpf: boolean;
  spfDetail: string;
  portMeasurementCount: number;
  findings: readonly Finding[];
} {
  const summary = getSummary(check.results, check.structuredResults);
  const spf = getRecord(check.results['spf']);
  const ports = check.results['ports'];
  const leaks = check.results['leaks'];

  return {
    summary,
    hasSpf: getBoolean(spf?.['hasSpf']) ?? check.structuredResults.resultsSPFRecord,
    spfDetail: getString(spf?.['spfRecord']) ?? (check.structuredResults.hasSPFRecordResult ? 'SPF-Signale gespeichert' : 'Kein SPF-Eintrag gespeichert'),
    portMeasurementCount: Array.isArray(ports) ? ports.length : getNumber(getRecord(ports)?.['openPorts']) ?? check.structuredResults.resultsOpenPorts,
    findings: getFindings(leaks, check.structuredResults),
  };
}

function getSummary(results: Record<string, unknown>, structured: StructuredResults): SummaryMetrics {
  const summary = getRecord(results['summary']);
  if (summary) {
    return {
      totalChecks: getNumber(summary['totalChecks']) ?? 4,
      passed: getNumber(summary['passed']) ?? 0,
      warnings: getNumber(summary['warnings']) ?? 0,
      failed: getNumber(summary['failed']) ?? 0,
    };
  }

  const warnings = [
    structured.resultsPWLeaks > 0,
    structured.resultsEmailLeaks > 0,
    structured.resultsEoLSoftware > 0,
    structured.resultsOpenPorts > 0,
  ].filter(Boolean).length;

  return {
    totalChecks: 4,
    passed: 4 - warnings,
    warnings,
    failed: 0,
  };
}

function getFindings(value: unknown, structured: StructuredResults): readonly Finding[] {
  if (Array.isArray(value)) {
    return value.map(toFinding).filter(isDefined);
  }

  const findings: Finding[] = [];
  if (structured.resultsPWLeaks > 0) findings.push({ type: 'Passwortlecks', severity: 'high', description: `${structured.resultsPWLeaks} Passwortlecks gefunden.`, source: 'Cysmo' });
  if (structured.resultsEmailLeaks > 0) findings.push({ type: 'E-Mail-Lecks', severity: 'medium', description: `${structured.resultsEmailLeaks} E-Mail-Lecks gefunden.`, source: 'Cysmo' });
  if (structured.resultsEoLSoftware > 0) findings.push({ type: 'EOL-Software', severity: 'medium', description: `${structured.resultsEoLSoftware} veraltete Software-Indikatoren gefunden.`, source: 'Cysmo' });
  return findings;
}

function toFinding(value: unknown): Finding | undefined {
  const record = getRecord(value);
  if (!record) return undefined;
  const type = getString(record['type']);
  const description = getString(record['description']);
  if (!type || !description) return undefined;
  return {
    type,
    severity: getSeverity(record['severity']),
    description,
    source: getString(record['source']) ?? 'Domain check',
  };
}

function getSeverity(value: unknown): Finding['severity'] {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : 'medium';
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
