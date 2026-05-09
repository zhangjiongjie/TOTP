export class CoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvalidBase32Error extends CoreError {}

export class InvalidOtpAuthUriError extends CoreError {}

export class InvalidTotpConfigError extends CoreError {}
