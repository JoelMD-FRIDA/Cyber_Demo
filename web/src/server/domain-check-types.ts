export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface DomainCheckResult {
  spf: Record<string, unknown>;
  ports: Record<string, unknown>;
  leaks: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CheckDomainOptions {
  userId: string;
  providerId?: string;
  categoryId?: string;
  hasAcceptedDisclaimer?: boolean;
  disclaimerVersion?: string;
}

export interface StructuredDomainCheckResult {
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

export type CysmoReportState =
  | 'UNKNOWN'
  | 'NEW'
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'
  | 'ERROR'
  | string;

export interface CysmoReportMessage {
  readonly nameKey?: string;
  readonly message?: string;
  readonly text?: string;
  readonly value?: unknown;
  readonly [key: string]: unknown;
}

export interface CysmoReportScore {
  readonly nameKey?: string;
  readonly value?: number;
  readonly messages?: readonly CysmoReportMessage[];
  readonly [key: string]: unknown;
}

export interface CysmoPartialRating {
  readonly nameKey?: string;
  readonly value?: number;
  readonly scores?: readonly CysmoReportScore[];
  readonly [key: string]: unknown;
}

export interface CysmoEntrypointsDto {
  readonly domains?: readonly string[];
  readonly nets?: readonly string[];
  readonly assocDomains?: readonly string[];
  readonly assocNets?: readonly string[];
  readonly [key: string]: unknown;
}

export interface CysmoBasicReport {
  readonly id?: string;
  readonly state?: CysmoReportState;
  readonly value?: number;
  readonly ratingTerm?: string;
  readonly [key: string]: unknown;
}

export interface CysmoCompanyResponse {
  readonly id?: string;
  readonly name?: string;
  readonly domains?: readonly string[];
  readonly reports?: readonly CysmoBasicReport[];
  readonly [key: string]: unknown;
}

export interface CysmoDetailedReport extends CysmoBasicReport {
  readonly partialRatings?: readonly CysmoPartialRating[];
  readonly entrypoints?: CysmoEntrypointsDto;
  readonly numberOfServers?: number;
  readonly managementSummaryData?: unknown;
}

export interface CysmoDomainCheckApiResponse {
  readonly domain?: string;
  readonly status: 'finished' | 'partial';
  readonly company?: CysmoCompanyResponse;
  readonly report?: CysmoDetailedReport | CysmoBasicReport;
  readonly createResponse?: unknown;
  readonly unacknowledgedSubdomains?: readonly string[];
  readonly [key: string]: unknown;
}

export interface CheckDomainResponse {
  checkId: string;
  url: string;
  status: string;
  remainingChecks: number;
  maxChecks: number;
  providerCount: number;
  results: Record<string, unknown>;
  structuredResults: StructuredDomainCheckResult;
}
