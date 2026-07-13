import type {
  CysmoDetailedReport,
  CysmoPartialRating,
  CysmoReportMessage,
  CysmoReportScore,
  DomainCheckResult,
  StructuredDomainCheckResult,
} from './domain-check-types';

const DNS_KEYWORDS = ['dns', 'spf', 'dmarc', 'dkim'] as const;
const SPF_KEYWORDS = ['spf'] as const;
const SOFTWARE_KEYWORDS = [
  'software',
  'eol',
  'end_of_life',
  'end-of-life',
  'outdated',
  'obsolete',
  'vulnerab',
  'cve',
] as const;
const DARKNET_KEYWORDS = ['darknet', 'leak', 'breach', 'credential', 'password', 'email'] as const;
const PASSWORD_KEYWORDS = ['password', 'credential', 'pw_leak', 'password_leak'] as const;
const EMAIL_KEYWORDS = ['email', 'mail_leak', 'email_leak'] as const;
const EOL_KEYWORDS = ['eol', 'end_of_life', 'end-of-life', 'obsolete', 'outdated'] as const;

interface RatingSignal {
  readonly nameKey: string;
  readonly value?: number;
  readonly messages: readonly string[];
}

export function mapCysmoResponseToStructuredResult(
  raw: Record<string, unknown>,
): StructuredDomainCheckResult {
  const legacy = mapLegacyResponse(raw);
  if (legacy) return legacy;

  const report = selectReport(raw);
  const partialRatings = getPartialRatings(report);
  const signals = buildRatingSignals(partialRatings);
  const dnsSignals = filterSignals(signals, DNS_KEYWORDS);
  const spfSignals = filterSignals(signals, SPF_KEYWORDS);
  const softwareSignals = filterSignals(signals, SOFTWARE_KEYWORDS);
  const leakSignals = filterSignals(signals, DARKNET_KEYWORDS);
  const passwordLeakCount = countFindings(raw, PASSWORD_KEYWORDS, filterSignals(signals, PASSWORD_KEYWORDS));
  const emailLeakCount = countFindings(raw, EMAIL_KEYWORDS, filterSignals(signals, EMAIL_KEYWORDS));
  const eolSoftwareCount = countFindings(raw, EOL_KEYWORDS, filterSignals(signals, EOL_KEYWORDS));
  const numberOfServers = report ? getNumber(report['numberOfServers']) : undefined;
  const entrypointCount = report ? countEntrypoints(report['entrypoints']) : 0;
  const openPortProxyCount = numberOfServers ?? entrypointCount;

  return {
    resultsPWLeaks: passwordLeakCount,
    resultsEmailLeaks: emailLeakCount,
    resultsEoLSoftware: eolSoftwareCount,
    resultsOpenPorts: openPortProxyCount,
    resultsSPFRecord: spfSignals.some((signal) => (signal.value ?? 0) >= 0.5),
    hasSPFRecordResult: dnsSignals.length > 0,
    hasDarknetResults: leakSignals.length > 0 || passwordLeakCount > 0 || emailLeakCount > 0,
    hasSoftwareResults: softwareSignals.length > 0 || eolSoftwareCount > 0,
    hasOpenPortsResults: openPortProxyCount > 0,
  };
}

export function parseCheckResponse(raw: Record<string, unknown>): {
  structured: StructuredDomainCheckResult;
  rich: DomainCheckResult;
} {
  const structured = mapCysmoResponseToStructuredResult(raw);
  const report = selectReport(raw);
  const partialRatings = getPartialRatings(report);
  const signals = buildRatingSignals(partialRatings);
  const rich: DomainCheckResult = {
    ...raw,
    spf: {
      hasSpf: structured.resultsSPFRecord,
      hasResults: structured.hasSPFRecordResult,
      signals: filterSignals(signals, DNS_KEYWORDS),
    },
    ports: {
      openPorts: structured.resultsOpenPorts,
      hasResults: structured.hasOpenPortsResults,
      numberOfServers: report ? getNumber(report['numberOfServers']) : undefined,
      entrypoints: report ? report['entrypoints'] : undefined,
    },
    leaks: {
      passwordLeaks: structured.resultsPWLeaks,
      emailLeaks: structured.resultsEmailLeaks,
      hasDarknetResults: structured.hasDarknetResults,
      signals: filterSignals(signals, DARKNET_KEYWORDS),
    },
    software: {
      eolSoftware: structured.resultsEoLSoftware,
      hasResults: structured.hasSoftwareResults,
      signals: filterSignals(signals, SOFTWARE_KEYWORDS),
    },
    cysmo: {
      value: report ? getNumber(report['value']) : undefined,
      ratingTerm: report ? getString(report['ratingTerm']) : undefined,
      partialRatings,
      report,
      company: isRecord(raw['company']) ? raw['company'] : undefined,
      raw,
    },
  };

  return { structured, rich };
}

function mapLegacyResponse(raw: Record<string, unknown>): StructuredDomainCheckResult | undefined {
  const results = raw['results'];
  if (!isRecord(results)) return undefined;
  const spf = isRecord(results['spf']) ? results['spf'] : undefined;
  const ports = isRecord(results['ports']) ? results['ports'] : undefined;
  const leaks = isRecord(results['leaks']) ? results['leaks'] : undefined;
  const software = isRecord(results['software']) ? results['software'] : undefined;
  if (!spf && !ports && !leaks && !software) return undefined;

  return {
    resultsPWLeaks: getNumber(leaks?.['password_leaks']) ?? 0,
    resultsEmailLeaks: getNumber(leaks?.['email_leaks']) ?? 0,
    resultsEoLSoftware: getNumber(software?.['eol_software']) ?? 0,
    resultsOpenPorts: getNumber(ports?.['open_ports']) ?? 0,
    resultsSPFRecord: spf?.['spf_record'] === true,
    hasSPFRecordResult: spf?.['has_spf_record_result'] === true,
    hasDarknetResults: leaks?.['has_darknet_results'] === true,
    hasSoftwareResults: software?.['has_software_results'] === true,
    hasOpenPortsResults: ports?.['has_open_ports_results'] === true,
  };
}

function selectReport(raw: Record<string, unknown>): CysmoDetailedReport | undefined {
  const report = raw['report'];
  if (isRecord(report)) return report;
  if ('partialRatings' in raw || 'numberOfServers' in raw || 'entrypoints' in raw) return raw;
  const company = raw['company'];
  if (!isRecord(company) || !Array.isArray(company['reports'])) return undefined;
  const reports = company['reports'].filter(isRecord);
  return reports.find((candidate) => candidate['state'] === 'FINISHED') ?? reports[0];
}

function getPartialRatings(report: CysmoDetailedReport | undefined): readonly CysmoPartialRating[] {
  if (!report || !Array.isArray(report['partialRatings'])) return [];
  return report['partialRatings'].map(toPartialRating).filter(isDefined);
}

function toPartialRating(value: unknown): CysmoPartialRating | undefined {
  if (!isRecord(value)) return undefined;
  return {
    nameKey: getString(value['nameKey']),
    value: getNumber(value['value']),
    scores: Array.isArray(value['scores']) ? value['scores'].map(toScore).filter(isDefined) : [],
  };
}

function toScore(value: unknown): CysmoReportScore | undefined {
  if (!isRecord(value)) return undefined;
  return {
    nameKey: getString(value['nameKey']),
    value: getNumber(value['value']),
    messages: Array.isArray(value['messages']) ? value['messages'].map(toMessage).filter(isDefined) : [],
  };
}

function toMessage(value: unknown): CysmoReportMessage | undefined {
  if (!isRecord(value)) return undefined;
  return {
    nameKey: getString(value['nameKey']),
    message: getString(value['message']),
    text: getString(value['text']),
    value: value['value'],
  };
}

function buildRatingSignals(partialRatings: readonly CysmoPartialRating[]): readonly RatingSignal[] {
  const signals: RatingSignal[] = [];
  for (const rating of partialRatings) {
    const ratingSignal = toSignal(rating.nameKey, rating.value, []);
    if (ratingSignal) signals.push(ratingSignal);
    for (const score of rating.scores ?? []) {
      const scoreSignal = toSignal(score.nameKey, score.value, getMessageTexts(score.messages ?? []));
      if (scoreSignal) signals.push(scoreSignal);
    }
  }
  return signals;
}

function toSignal(
  nameKey: string | undefined,
  value: number | undefined,
  messages: readonly string[],
): RatingSignal | undefined {
  if (!nameKey && messages.length === 0) return undefined;
  return { nameKey: nameKey ?? '', value, messages };
}

function getMessageTexts(messages: readonly CysmoReportMessage[]): readonly string[] {
  return messages.flatMap((message) =>
    [message.nameKey, message.message, message.text, getString(message.value)].filter(isDefined),
  );
}

function filterSignals(
  signals: readonly RatingSignal[],
  keywords: readonly string[],
): readonly RatingSignal[] {
  return signals.filter((signal) => textContainsKeyword(signalText(signal), keywords));
}

function countFindings(
  raw: Record<string, unknown>,
  keywords: readonly string[],
  signals: readonly RatingSignal[],
): number {
  const keyedCount = sumNumbersByMatchingKey(raw, keywords);
  if (keyedCount > 0) return keyedCount;
  return sumMessageNumbers(signals, keywords);
}

function sumNumbersByMatchingKey(value: unknown, keywords: readonly string[]): number {
  if (Array.isArray(value)) {
    return value.reduce((sum: number, item) => sum + sumNumbersByMatchingKey(item, keywords), 0);
  }
  if (!isRecord(value)) return 0;

  return Object.entries(value).reduce((sum, [key, child]) => {
    if (typeof child === 'number' && Number.isFinite(child) && textContainsKeyword(key, keywords)) {
      return sum + Math.max(0, Math.trunc(child));
    }
    return sum + sumNumbersByMatchingKey(child, keywords);
  }, 0);
}

function sumMessageNumbers(signals: readonly RatingSignal[], keywords: readonly string[]): number {
  return signals.reduce((sum, signal) => {
    const matchingMessages = signal.messages.filter((message) => textContainsKeyword(message, keywords));
    return sum + matchingMessages.reduce((messageSum, message) => messageSum + extractFirstInteger(message), 0);
  }, 0);
}

function countEntrypoints(value: unknown): number {
  if (!isRecord(value)) return 0;
  return ['domains', 'nets', 'assocDomains', 'assocNets'].reduce((sum, key) => {
    const entry = value[key];
    return sum + (Array.isArray(entry) ? entry.length : 0);
  }, 0);
}

function signalText(signal: RatingSignal): string {
  return [signal.nameKey, ...signal.messages].join(' ').toLowerCase();
}

function textContainsKeyword(text: string, keywords: readonly string[]): boolean {
  const normalizedText = text.toLowerCase();
  return keywords.some((keyword) => normalizedText.includes(keyword.toLowerCase()));
}

function extractFirstInteger(text: string): number {
  const match = /\b\d+\b/.exec(text);
  return match?.[0] ? Number.parseInt(match[0], 10) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
