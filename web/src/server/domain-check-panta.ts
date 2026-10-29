import { fetchProviderJson } from './provider-http';
import {
  DomainCheckProviderError,
  type DomainCheckProvider,
  type ProviderJob,
  type ProviderPollResult,
  type ProviderStartInput,
} from './domain-check-provider';

const DEFAULT_PANTA_API_BASE_URL = 'https://api.moses-security.de';

interface PantaConfig {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
}

function getPantaConfig(): PantaConfig | null {
  const apiKey = process.env.PANTA_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiBaseUrl: process.env.PANTA_API_BASE_URL?.trim() || DEFAULT_PANTA_API_BASE_URL,
    apiKey,
  };
}

export function isValidPantaContact(value: string): boolean {
  const contact = value.trim();
  if (/^\S+@\S+\.\S+$/.test(contact)) return true;
  const normalizedPhone = contact.replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(normalizedPhone);
}

export function normalizePantaContact(value: string): string {
  const contact = value.trim();
  return contact.includes('@') ? contact.toLowerCase() : contact;
}

class PantaProvider implements DomainCheckProvider {
  readonly key = 'panta';
  readonly inputType = 'contact' as const;
  get isConfigured() { return getPantaConfig() !== null; }

  async start(input: ProviderStartInput): Promise<ProviderJob> {
    const config = getPantaConfig();
    if (!config) throw new DomainCheckProviderError('PROVIDER_NOT_CONFIGURED', 'PANTA provider is not configured.', false);

    const contact = normalizePantaContact(input.url);
    const response = await queryPanta(config, contact);
    return {
      externalJobId: 'panta-query',
      completed: true,
      snapshot: { contact, panta: response },
    };
  }

  async poll(): Promise<ProviderPollResult> {
    return {
      status: 'failed',
      errorCode: 'PANTA_NOT_POLLABLE',
      errorMessage: 'PANTA queries complete synchronously.',
    };
  }

  normalize(result: unknown) {
    const raw = isRecord(result) ? result : {};
    const response = isRecord(raw.panta) ? raw.panta : raw;
    const breaches = getStringArray(response.breaches);
    const newBreaches = getStringArray(response.newBreaches);
    const breached = response.breached === true || breaches.length > 0 || newBreaches.length > 0;
    const emailLeakCount = Math.max(breaches.length, breached ? 1 : 0);
    const signals = breaches.map((breach) => ({
      nameKey: 'PANTA',
      message: breach,
      severity: 'high',
    }));

    return {
      structuredResult: {
        resultsPWLeaks: 0,
        resultsEmailLeaks: emailLeakCount,
        resultsEoLSoftware: 0,
        resultsOpenPorts: 0,
        resultsSPFRecord: false,
        hasSPFRecordResult: false,
        hasDarknetResults: breached,
        hasSoftwareResults: false,
        hasOpenPortsResults: false,
      },
      richResult: {
        ...raw,
        spf: { hasResults: false },
        ports: { hasResults: false },
        panta: {
          error: getNumber(response.error) ?? 0,
          message: getString(response.message),
          breached,
          breaches,
          newBreaches,
          canSendInfo: response.canSendInfo === true,
          sendTimeLeft: getNumber(response.sendTimeLeft),
        },
        leaks: {
          passwordLeaks: 0,
          emailLeaks: emailLeakCount,
          hasDarknetResults: breached,
          signals,
        },
        software: { hasResults: false },
      },
    };
  }
}

export const pantaProvider = new PantaProvider();

async function queryPanta(config: PantaConfig, contact: string): Promise<Record<string, unknown>> {
  const response = await fetchProviderJson(`${config.apiBaseUrl.replace(/\/+$/, '')}/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'FRIDA DomainCheck' },
    body: JSON.stringify({ apiKey: config.apiKey, contact, showBreaches: true }),
  });
  if (!response.ok) {
    throw new DomainCheckProviderError(
      `PANTA_HTTP_${response.status}`,
      `PANTA API request failed (${response.status}).`,
      response.status >= 500 || response.status === 429,
    );
  }
  const body = response.body;
  if (!isRecord(body)) {
    throw new DomainCheckProviderError('PANTA_INVALID_RESPONSE', 'PANTA API returned an invalid response.', false);
  }
  const errorCode = parseErrorCode(body.error);
  if (errorCode !== 0) {
    throw new DomainCheckProviderError(getPantaErrorCode(errorCode), `PANTA API returned error ${errorCode}.`, errorCode === 1);
  }
  return body;
}

function getPantaErrorCode(code: number): string {
  const codes: Record<number, string> = {
    1: 'PANTA_UNKNOWN_ERROR',
    2: 'PANTA_INVALID_API_KEY',
    3: 'PANTA_API_KEY_EXPIRED',
    4: 'PANTA_INVALID_CONTACT',
    5: 'PANTA_INVALID_ACTION',
  };
  return codes[code] ?? `PANTA_ERROR_${code}`;
}

function parseErrorCode(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
