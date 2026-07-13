export class RateLimitError extends Error {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class DisclaimerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisclaimerError';
  }
}

export class CheckLimitError extends Error {
  public readonly maxChecks: number;
  public readonly remainingChecks: number;

  constructor(message: string, maxChecks: number, remainingChecks: number) {
    super(message);
    this.name = 'CheckLimitError';
    this.maxChecks = maxChecks;
    this.remainingChecks = remainingChecks;
  }
}
