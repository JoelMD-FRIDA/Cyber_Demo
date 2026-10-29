export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'EMAIL_NOT_CONFIRMED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AUTH_PROVIDER_UNAVAILABLE'
  | 'REGISTRATION_KEY_NOT_FOUND'
  | 'REGISTRATION_KEY_DISABLED'
  | 'REGISTRATION_KEY_EXPIRED'
  | 'REGISTRATION_KEY_EXHAUSTED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'CHECK_NOT_FOUND'
  | 'CHECK_FAILED'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code, ...error.details }, { status: error.status });
  }

  console.error('Application request failed.');
  return Response.json({ error: 'An unexpected server error occurred.', code: 'INTERNAL_ERROR' }, { status: 500 });
}
