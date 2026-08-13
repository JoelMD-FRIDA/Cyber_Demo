export function getDomainCheckLimit(): number {
  const raw = Number.parseInt(process.env.DOMAIN_CHECK_MAX_PER_USER ?? '10', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

export const CURRENT_DISCLAIMER_VERSION = '1.0';

export function getCronBatchSize(): number {
  return 5;
}

export function getCronLeaseSeconds(): number {
  return 45;
}
