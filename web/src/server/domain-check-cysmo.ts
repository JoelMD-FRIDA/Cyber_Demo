import { fetchCysmoJson, formatResponseBody } from './domain-check-cysmo-http';
import { normalizeDomainName } from './domain-check-url';

const REPORT_POLL_INTERVAL_MS = 15_000;
const REPORT_POLL_TIMEOUT_MS = 120_000;
const REPORT_POLL_ATTEMPTS = 8;

interface CysmoReportRequest {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly reportId: string;
}

export async function sendCheckRequest(
  apiBaseUrl: string,
  token: string,
  url: string,
): Promise<Record<string, unknown>> {
  const domain = normalizeDomainName(url);
  const createResponse = await fetchCysmoJson({
    apiBaseUrl,
    token,
    path: '/v2/companies?acceptSubDomain=true&acceptNotReachable=true',
    method: 'POST',
    body: JSON.stringify({ domains: [domain], nets: [] }),
  });

  const isAcknowledgementError =
    createResponse.status === 422 && isUnacknowledgedSubdomainsError(createResponse.body);

  if (!createResponse.ok && !isAcknowledgementError) {
    throw new Error(
      `Domain check request failed (${createResponse.status}): ${formatResponseBody(createResponse)}`,
    );
  }

  const companyId = getCompanyId(createResponse.body, createResponse.headers);
  if (!companyId) {
    return {
      domain,
      status: 'partial',
      createResponse: createResponse.body,
      unacknowledgedSubdomains: getUnacknowledgedSubdomains(createResponse.body),
      partialReason: 'Cysmo company creation did not include a company id.',
    };
  }

  const readyReportId = findReadyReportId(createResponse.body);
  if (readyReportId) {
    const report = await fetchReportResult({ apiBaseUrl, token, reportId: readyReportId });
    return {
      domain,
      status: 'finished',
      company: createResponse.body,
      report,
    };
  }

  const deadline = Date.now() + REPORT_POLL_TIMEOUT_MS;
  let latestCompany = createResponse.body;

  for (let attempt = 1; attempt <= REPORT_POLL_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      await sleep(Math.min(REPORT_POLL_INTERVAL_MS, remainingMs));
    }

    const companyResponse = await fetchCysmoJson({
      apiBaseUrl,
      token,
      path: `/v2/companies/${encodeURIComponent(companyId)}`,
    });

    if (!companyResponse.ok) {
      throw new Error(
        `Cysmo company poll failed (${companyResponse.status}): ${formatResponseBody(companyResponse)}`,
      );
    }

    latestCompany = companyResponse.body;
    const reportId = findReadyReportId(companyResponse.body);
    if (reportId) {
      const report = await fetchReportResult({ apiBaseUrl, token, reportId });
      return {
        domain,
        status: 'finished',
        company: latestCompany,
        report,
      };
    }
  }

  return {
    domain,
    status: 'partial',
    company: latestCompany,
    createResponse: createResponse.body,
    unacknowledgedSubdomains: getUnacknowledgedSubdomains(createResponse.body),
    partialReason: 'Cysmo report did not finish before the polling timeout.',
  };
}

async function fetchReportResult(request: CysmoReportRequest): Promise<unknown> {
  const reportResponse = await fetchCysmoJson({
    apiBaseUrl: request.apiBaseUrl,
    token: request.token,
    path: `/v2/reports/${encodeURIComponent(request.reportId)}?dataMode=TECH`,
  });

  if (!reportResponse.ok) {
    throw new Error(
      `Cysmo report fetch failed (${reportResponse.status}): ${formatResponseBody(reportResponse)}`,
    );
  }

  return reportResponse.body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function isUnacknowledgedSubdomainsError(body: unknown): boolean {
  if (!isRecord(body)) return false;
  return body['type'] === 'UNACKNOWLEDGED_SUBDOMAINS';
}

function getUnacknowledgedSubdomains(body: unknown): readonly string[] | undefined {
  if (!isRecord(body)) return undefined;
  return getStringArray(body['domains']);
}

function getCompanyId(body: unknown, headers: Headers): string | undefined {
  const bodyId = getIdFromBody(body);
  if (bodyId) return bodyId;

  const location = headers.get('Location');
  if (!location) return undefined;
  const match = /\/v2\/companies\/([^/?#]+)/.exec(location) ?? /\/companies\/([^/?#]+)/.exec(location);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function getIdFromBody(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const id = getString(body['id']);
  if (id) return id;

  const company = body['company'];
  if (!isRecord(company)) return undefined;
  return getString(company['id']);
}

function findReadyReportId(body: unknown): string | undefined {
  const reports = getReports(body);
  const report = reports.find(isReportReady);
  return report ? getString(report['id']) : undefined;
}

function isReportReady(report: Record<string, unknown>): boolean {
  return report['running'] === false || report['state'] === 'FINISHED' || report['finished'] === true;
}

function getReports(body: unknown): readonly Record<string, unknown>[] {
  const company = isRecord(body) && isRecord(body['company']) ? body['company'] : body;
  if (!isRecord(company) || !Array.isArray(company['reports'])) return [];
  return company['reports'].filter(isRecord);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
