import type { DomainCheckResult, StructuredDomainCheckResult } from './domain-check-types';

export type ProviderInputType = 'domain' | 'contact';

export interface ProviderStartInput {
  readonly url: string;
  readonly providerKey: string;
}

export interface ProviderPollInput {
  readonly url: string;
  readonly externalJobId: string;
  readonly externalReportId?: string | null;
  readonly providerKey: string;
}

export interface ProviderJob {
  readonly externalJobId: string;
  readonly externalReportId?: string;
  readonly snapshot: Record<string, unknown>;
  readonly completed?: boolean;
}

export type ProviderPollResult =
  | { readonly status: 'pending'; readonly snapshot: Record<string, unknown>; readonly externalReportId?: string }
  | { readonly status: 'completed'; readonly snapshot: Record<string, unknown>; readonly externalReportId?: string }
  | { readonly status: 'failed'; readonly errorCode: string; readonly errorMessage: string; readonly snapshot?: Record<string, unknown> };

export interface DomainCheckProvider {
  readonly key: string;
  readonly inputType: ProviderInputType;
  readonly isConfigured: boolean;
  start: (...args: [ProviderStartInput]) => Promise<ProviderJob>;
  poll: (...args: [ProviderPollInput]) => Promise<ProviderPollResult>;
  normalize: (...args: [unknown]) => {
    readonly structuredResult: StructuredDomainCheckResult;
    readonly richResult: DomainCheckResult;
  };
}

export class DomainCheckProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    retryable = true,
  ) {
    super(message);
    this.name = 'DomainCheckProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}
