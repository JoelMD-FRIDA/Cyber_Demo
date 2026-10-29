// Classify only fixed values. Never emit provider messages, claims or error causes.
export function loginFailureCategory(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Invalid login transaction.' || message === 'Expired or replayed login transaction.') return 'TRANSACTION_EXPIRED_OR_REPLACED';
  if (message === 'Origin mismatch.') return 'ORIGIN_MISMATCH';
  if (message === 'This identity is not authorized for the sandbox.') return 'IDENTITY_NOT_ALLOWED';
  if (message === 'This account is disabled or differs from the original session.') return 'ACCOUNT_DISABLED_OR_CHANGED';
  let current: unknown = error;
  for (let depth=0; depth<4 && current && typeof current==='object'; depth++) {
    const item = current as { code?:unknown; error?:unknown; name?:unknown; cause?:unknown };
    if (item.code==='OAUTH_TIMEOUT' || item.name==='TimeoutError') return 'IDENTITY_TIMEOUT';
    if (item.code==='OAUTH_ABORT' || item.name==='AbortError') return 'IDENTITY_ABORTED';
    if (item.error==='invalid_client') return 'IDENTITY_CLIENT_REJECTED';
    if (item.error==='invalid_grant') return 'IDENTITY_CODE_REJECTED';
    if (item.error==='login_required' || item.error==='interaction_required' || item.error==='consent_required') return 'IDENTITY_INTERACTION_REQUIRED';
    if (item.error==='access_denied') return 'IDENTITY_ACCESS_DENIED';
    if (item.code==='OAUTH_JWT_TIMESTAMP_CHECK_FAILED') return 'IDENTITY_TOKEN_TIME_INVALID';
    if (item.code==='OAUTH_JWT_CLAIM_COMPARISON_FAILED') return 'IDENTITY_TOKEN_CLAIM_INVALID';
    if (item.code==='OAUTH_KEY_SELECTION_FAILED' || item.code==='OAUTH_JWT_SIGNATURE_VERIFICATION_FAILED') return 'IDENTITY_TOKEN_SIGNATURE_INVALID';
    if (item.code==='23505') return 'IDENTITY_EMAIL_CONFLICT';
    if (item.code==='55P03' || item.code==='57014') return 'LOGIN_DATABASE_BUSY';
    current=item.cause;
  }
  return 'IDENTITY_SERVICE_OR_TOKEN_VALIDATION';
}
