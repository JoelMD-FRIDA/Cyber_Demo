export function getDomainCheckLimit(): number {
  const raw = Number.parseInt(process.env.DOMAIN_CHECK_MAX_PER_USER ?? '10', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

export const CURRENT_DISCLAIMER_VERSION = '1.0';

export function getCronBatchSize(): number {
  return 1;
}

export function getCronLeaseSeconds(): number {
  return 120;
}

export function getDomainCheckPollIntervalMs(): number {
  const raw = Number.parseInt(process.env.DOMAIN_CHECK_POLL_INTERVAL_SECONDS ?? '5', 10);
  const seconds = Number.isFinite(raw) ? Math.min(Math.max(raw, 3), 30) : 5;
  return seconds * 1000;
}
