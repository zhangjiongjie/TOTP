export class CoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export class InvalidBase32Error extends CoreError {}

export class InvalidOtpAuthUriError extends CoreError {}

export class InvalidTotpConfigError extends CoreError {}
