export function normalizeDomainName(value: string): string {
  try {
    const parsed = parsePossiblySchemelessUrl(value);
    return parsed.hostname.toLowerCase();
  } catch (error) {
    if (error instanceof TypeError) {
      return value
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0]
        .toLowerCase();
    }
    throw error;
  }
}

function parsePossiblySchemelessUrl(value: string): URL {
  const trimmedValue = value.trim();
  return new URL(trimmedValue.includes('://') ? trimmedValue : `https://${trimmedValue}`);
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = parsePossiblySchemelessUrl(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
