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

interface SummaryMetrics { totalChecks: number; passed: number; warnings: number; failed: number }

export function buildViewModel(check: SavedDomainCheck): {
  summary: SummaryMetrics;
  structured: StructuredResults;
  hasSpf: boolean;
  spfDetail: string;
  portMeasurementCount: number;
  findings: readonly Finding[];
} {
  const structured = toStructured(check.structuredResult);
  const raw = check.rawResult ?? {};
  const spf = getRecord(raw.spf);
  const ports = getRecord(raw.ports);
  const leaks = getRecord(raw.leaks);
  const software = getRecord(raw.software);
  const warningCount = [structured.resultsPWLeaks, structured.resultsEmailLeaks, structured.resultsEoLSoftware, structured.resultsOpenPorts].filter((value) => value > 0).length;

  return {
    structured,
    summary: { totalChecks: 4, passed: 4 - warningCount, warnings: warningCount, failed: check.status === 'failed' ? 1 : 0 },
    hasSpf: getBoolean(spf?.hasSpf) ?? structured.resultsSPFRecord,
    spfDetail: getString(spf?.spfRecord) ?? (structured.hasSPFRecordResult ? 'SPF signals stored' : 'No SPF record stored'),
    portMeasurementCount: getNumber(ports?.openPorts) ?? structured.resultsOpenPorts,
    findings: getFindings(leaks, software, structured),
  };
}

function toStructured(value: unknown): StructuredResults {
  const record = getRecord(value);
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
  };
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
function getString(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function getNumber(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function getBoolean(value: unknown): boolean | undefined { return typeof value === 'boolean' ? value : undefined; }
