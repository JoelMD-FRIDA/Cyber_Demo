import type { CysmoClassificationCounts } from '@/server/domain-check-types';

export interface StructuredResults {
  resultsPWLeaks: number;
  resultsEmailLeaks: number;
  resultsEoLSoftware: number;
  resultsOpenPorts: number;
  resultsSPFRecord: boolean;
  hasSPFRecordResult: boolean;
  hasDarknetResults: boolean;
  hasSoftwareResults: boolean;
  hasOpenPortsResults: boolean;
  classifications: CysmoClassificationCounts | null;
  technicalScore: number | null;
  businessScore: number | null;
  technicalRating: string | null;
  businessRating: string | null;
}

export interface SavedDomainCheck {
  id: string;
  url: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | string;
  provider: { id: string; key: string; name: string } | null;
  category: { id: string; key: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  remainingChecks: number;
  maxChecks: number;
  attemptCount: number;
  externalJobId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawResult: Record<string, unknown> | null;
  structuredResult: unknown;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SavedDomainCheckResponse { check: SavedDomainCheck }

export interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
}

interface SummaryMetrics { totalChecks: number; passed: number; neutral: number; warnings: number; failed: number }

export interface DomainCheckAssessment {
  classifications: CysmoClassificationCounts;
  technicalScore: number | null;
  businessScore: number | null;
  technicalRating: string | null;
  businessRating: string | null;
}

export function buildViewModel(check: SavedDomainCheck): {
  summary: SummaryMetrics;
  structured: StructuredResults;
  assessment: DomainCheckAssessment | null;
  hasSpf: boolean;
  hasSpfMeasurement: boolean;
  spfDetail: string | null;
  portMeasurementCount: number | null;
  hasSoftwareMeasurement: boolean;
  unacknowledgedSubdomains: readonly string[];
  findings: readonly Finding[];
} {
  const raw = check.rawResult ?? {};
  const structured = toStructured(check.structuredResult, raw);
  const spf = getRecord(raw.spf);
  const ports = getRecord(raw.ports);
  const leaks = getRecord(raw.leaks);
  const software = getRecord(raw.software);
  const cysmoRaw = getRecord(getRecord(raw.cysmo)?.raw);
  const hasSpfMeasurement = getBoolean(spf?.hasResults) ?? structured.hasSPFRecordResult;
  const hasOpenPortsMeasurement = getBoolean(ports?.hasResults) ?? structured.hasOpenPortsResults;
  const hasSoftwareMeasurement = getBoolean(software?.hasResults) ?? structured.hasSoftwareResults;
  const warningCount = [structured.resultsPWLeaks, structured.resultsEmailLeaks, structured.resultsEoLSoftware, structured.resultsOpenPorts].filter((value) => value > 0).length;
  const classifications = structured.classifications;
  const totalClassifications = classifications ? sumClassifications(classifications) : 0;

  return {
    structured,
    assessment: classifications ? {
      classifications,
      technicalScore: structured.technicalScore,
      businessScore: structured.businessScore,
      technicalRating: structured.technicalRating,
      businessRating: structured.businessRating,
    } : null,
    summary: classifications
      ? {
        totalChecks: totalClassifications,
        passed: classifications.good,
        neutral: classifications.neutral,
        warnings: classifications.warning,
        failed: classifications.critical + classifications.catastrophic,
      }
      : { totalChecks: 4, passed: 4 - warningCount, neutral: 0, warnings: warningCount, failed: check.status === 'failed' ? 1 : 0 },
    hasSpf: getBoolean(spf?.hasSpf) ?? structured.resultsSPFRecord,
    hasSpfMeasurement,
    spfDetail: getString(spf?.spfRecord) ?? null,
    portMeasurementCount: hasOpenPortsMeasurement ? getNumber(ports?.openPorts) ?? structured.resultsOpenPorts : null,
    hasSoftwareMeasurement,
    unacknowledgedSubdomains: getStringArray(raw.unacknowledgedSubdomains) ?? getStringArray(cysmoRaw?.unacknowledgedSubdomains) ?? [],
    findings: getFindings(leaks, software, structured),
  };
}

function toStructured(value: unknown, raw: Record<string, unknown>): StructuredResults {
  const record = getRecord(value);
  const report = getReport(raw);
  return {
    resultsPWLeaks: getNumber(record?.resultsPWLeaks) ?? 0,
    resultsEmailLeaks: getNumber(record?.resultsEmailLeaks) ?? 0,
    resultsEoLSoftware: getNumber(record?.resultsEoLSoftware) ?? 0,
    resultsOpenPorts: getNumber(record?.resultsOpenPorts) ?? 0,
    resultsSPFRecord: getBoolean(record?.resultsSPFRecord) ?? false,
    hasSPFRecordResult: getBoolean(record?.hasSPFRecordResult) ?? false,
    hasDarknetResults: getBoolean(record?.hasDarknetResults) ?? false,
    hasSoftwareResults: getBoolean(record?.hasSoftwareResults) ?? false,
    hasOpenPortsResults: getBoolean(record?.hasOpenPortsResults) ?? false,
    classifications: toClassifications(record?.classifications) ?? toClassifications(report?.classifications) ?? null,
    technicalScore: getNumber(record?.technicalScore) ?? getNumber(report?.valueTech) ?? getNumber(report?.value) ?? null,
    businessScore: getNumber(record?.businessScore) ?? getNumber(report?.valueBusiness) ?? null,
    technicalRating: getString(record?.technicalRating) ?? getString(report?.ratingScoreTermTech) ?? getString(report?.ratingTerm) ?? null,
    businessRating: getString(record?.businessRating) ?? getString(report?.ratingScoreTermBusiness) ?? null,
  };
}

function getReport(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const directReport = getRecord(raw.report);
  if (directReport) return directReport;
  const cysmo = getRecord(raw.cysmo);
  const cysmoReport = getRecord(cysmo?.report);
  if (cysmoReport) return cysmoReport;
  const cysmoRawReport = getRecord(getRecord(cysmo?.raw)?.report);
  if (cysmoRawReport) return cysmoRawReport;
  const company = getRecord(raw.company);
  const reports = company?.reports;
  if (!Array.isArray(reports)) return undefined;
  const reportCandidates = reports.map((item) => getRecord(item)).filter(isDefined);
  return reportCandidates.find((candidate) => candidate.state === 'FINISHED') ?? reportCandidates[0];
}

function toClassifications(value: unknown): CysmoClassificationCounts | null {
  const record = getRecord(value);
  if (!record) return null;
  const hasClassificationKey = ['GOOD', 'NEUTRAL', 'WARNING', 'CRITICAL', 'CATASTROPHIC', 'good', 'neutral', 'warning', 'critical', 'catastrophic'].some((key) => key in record);
  if (!hasClassificationKey) return null;
  return {
    good: getCount(record.GOOD ?? record.good),
    neutral: getCount(record.NEUTRAL ?? record.neutral),
    warning: getCount(record.WARNING ?? record.warning),
    critical: getCount(record.CRITICAL ?? record.critical),
    catastrophic: getCount(record.CATASTROPHIC ?? record.catastrophic),
  };
}

function sumClassifications(value: CysmoClassificationCounts): number {
  return value.good + value.neutral + value.warning + value.critical + value.catastrophic;
}

function getFindings(leaks: Record<string, unknown> | undefined, software: Record<string, unknown> | undefined, structured: StructuredResults): readonly Finding[] {
  const signals = [...toFindings(leaks?.signals, 'Cysmo'), ...toFindings(software?.signals, 'Cysmo')];
  if (signals.length > 0) return signals;
  const findings: Finding[] = [];
  if (structured.resultsPWLeaks > 0) findings.push({ type: 'Password leaks', severity: 'high', description: `${structured.resultsPWLeaks} password leaks found.`, source: 'Cysmo' });
  if (structured.resultsEmailLeaks > 0) findings.push({ type: 'Email leaks', severity: 'medium', description: `${structured.resultsEmailLeaks} email leaks found.`, source: 'Cysmo' });
  if (structured.resultsEoLSoftware > 0) findings.push({ type: 'End-of-life software', severity: 'medium', description: `${structured.resultsEoLSoftware} outdated software indicators found.`, source: 'Cysmo' });
  return findings;
}

function toFindings(value: unknown, source: string): Finding[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = getRecord(item);
    if (!record) return [];
    const type = getString(record.nameKey) ?? getString(record.type);
    const description = getString(record.message) ?? getString(record.text) ?? getString(record.description);
    if (!type || !description) return [];
    return [{ type, severity: getSeverity(record.severity), description, source }];
  });
}

function getSeverity(value: unknown): Finding['severity'] {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : 'medium';
}
function getRecord(value: unknown): Record<string, unknown> | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function getStringArray(value: unknown): readonly string[] | undefined { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : undefined; }
function getString(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function getNumber(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function getCount(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0; }
function getBoolean(value: unknown): boolean | undefined { return typeof value === 'boolean' ? value : undefined; }
function isDefined<T>(value: T | undefined): value is T { return value !== undefined; }
