export class VaultError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;

    if (options && 'cause' in options) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true
      });
    }
  }
}

export class VaultParameterError extends VaultError {}

export class VaultAuthenticationError extends VaultError {}

export class VaultIntegrityError extends VaultError {}

export class VaultImportFormatError extends VaultError {}

export class VaultStorageUnavailableError extends VaultError {}
