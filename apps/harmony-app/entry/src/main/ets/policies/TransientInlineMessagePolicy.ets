export class InlineMessageState {
  statusMessage: string;
  errorMessage: string;
  version: number;

  constructor(statusMessage: string, errorMessage: string, version: number) {
    this.statusMessage = statusMessage;
    this.errorMessage = errorMessage;
    this.version = version;
  }
}

export class TransientInlineMessagePolicy {
  static showStatus(state: InlineMessageState, message: string): InlineMessageState {
    return new InlineMessageState(message, '', state.version + 1);
  }

  static showError(state: InlineMessageState, message: string): InlineMessageState {
    return new InlineMessageState('', message, state.version + 1);
  }

  static clearIfVersion(state: InlineMessageState, version: number): InlineMessageState {
    if (state.version !== version) {
      return state;
    }
    return new InlineMessageState('', '', state.version);
  }
}
