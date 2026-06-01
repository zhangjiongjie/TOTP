import { common } from '@kit.AbilityKit';
import { UnlockService, UnlockState } from '../services/UnlockService';
import { AppI18n } from '../utils/AppI18n';

@Component
export struct Unlock {
  onUnlocked?: () => void;
  @State private password: string = '';
  @State private hasMasterPassword: boolean = false;
  @State private isUnlocked: boolean = false;
  @State private biometricUnlockAvailable: boolean = false;
  @State private errorMessage: string = '';
  @State private isBiometricAuthenticating: boolean = false;
  @State private hasTriedAutoBiometricUnlock: boolean = false;

  aboutToAppear(): void {
    this.syncState();
    setTimeout(() => {
      this.tryAutoBiometricUnlock();
    }, 250);
  }

  build() {
    Column() {
      this.buildFixedHeader()
      Scroll() {
        Column() {
          this.buildPasswordCard()
        }
        .width('100%')
        .justifyContent(FlexAlign.Start)
        .padding({ left: 20, right: 20, top: 6, bottom: 28 })
      }
      .scrollBar(BarState.Off)
      .width('100%')
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  @Builder
  private buildFixedHeader(): void {
    Row() {
      Text($r('app.string.unlock_title'))
        .fontSize(25)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(this.resolveHeaderHeight())
    .alignItems(VerticalAlign.Top)
    .padding({ left: 20, right: 20, top: 14 })
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  @Builder
  private buildPasswordCard(): void {
    Column({ space: 14 }) {
      Text($r('app.string.unlock_master_password_label'))
        .fontSize(17)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))
        .width('100%')

      Text(this.hasMasterPassword ? $r('app.string.unlock_existing_hint') : $r('app.string.unlock_new_hint'))
        .fontSize(13)
        .fontColor($r('sys.color.font_secondary'))
        .width('100%')

      TextInput({
        placeholder: this.hasMasterPassword ? $r('app.string.unlock_existing_placeholder') : $r('app.string.unlock_new_placeholder'),
        text: this.password
      })
        .type(InputType.Password)
        .fontSize(16)
        .fontColor($r('sys.color.font_primary'))
        .placeholderColor($r('app.color.color_unlock_placeholder'))
        .backgroundColor($r('app.color.color_control_surface'))
        .borderRadius(18)
        .height(52)
        .padding({ left: 16, right: 16 })
        .onChange((value: string) => {
          this.password = value;
        })

      Button($r('app.string.unlock_submit'))
        .type(ButtonType.Capsule)
        .width('100%')
        .height(48)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.ohos_id_color_foreground_contrary'))
        .backgroundColor($r('app.color.color_primary'))
        .onClick(() => {
          this.handlePasswordUnlock();
        })

      if (this.biometricUnlockAvailable) {
        Button(this.isBiometricAuthenticating ? $r('app.string.action_verifying') : $r('app.string.unlock_biometric_button'))
          .type(ButtonType.Capsule)
          .width('100%')
          .height(46)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.color_primary_text'))
          .backgroundColor($r('app.color.color_control_surface'))
          .enabled(!this.isBiometricAuthenticating)
          .onClick(() => {
            this.handleBiometricUnlock();
          })
      }

      if (this.errorMessage.length > 0) {
        Text(this.errorMessage)
          .fontSize(13)
          .lineHeight(20)
          .fontColor($r('app.color.color_danger'))
          .width('100%')
      }
    }
    .width('100%')
    .padding(18)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(24)
  }

  private handlePasswordUnlock(): void {
    let context: common.UIAbilityContext = this.getHostContext();
    let service: UnlockService = UnlockService.getInstance();

    try {
      let state: UnlockState = service.unlockWithPassword(context, this.password);
      this.password = '';
      this.errorMessage = '';
      this.applyState(state);
      if (state.isUnlocked && this.onUnlocked) {
        this.onUnlocked();
      }
    } catch (error) {
      let message: string = (error as Error).message;
      this.isUnlocked = false;
      this.errorMessage = message.length > 0 ? message : this.appString($r('app.string.error_unlock_failed'), 'Unlock failed. Please try again later.');
    }
  }

  private async handleBiometricUnlock(autoTriggered: boolean = false): Promise<void> {
    if (this.isBiometricAuthenticating) {
      return;
    }

    let context: common.UIAbilityContext = this.getHostContext();
    let service: UnlockService = UnlockService.getInstance();

    this.isBiometricAuthenticating = true;
    if (autoTriggered) {
      this.errorMessage = this.appString($r('app.string.unlock_biometric_starting'), 'Starting face / fingerprint verification. You can also unlock with the master password.');
    }

    try {
      let state: UnlockState = await service.unlockWithBiometric(context);
      this.password = '';
      this.errorMessage = '';
      this.applyState(state);
      if (state.isUnlocked && this.onUnlocked) {
        this.onUnlocked();
      }
    } catch (error) {
      let message: string = (error as Error).message;
      this.isUnlocked = false;
      let fallbackMessage: string = message.length > 0 ? message : this.appString($r('app.string.error_biometric_unlock_failed'), 'Biometric unlock failed. Use the master password.');
      this.errorMessage = autoTriggered
        ? this.appFormat($r('app.string.unlock_biometric_continue_password'), '%1$s You can still unlock with the master password.', fallbackMessage)
        : fallbackMessage;
    } finally {
      this.isBiometricAuthenticating = false;
    }
  }

  private tryAutoBiometricUnlock(): void {
    if (this.hasTriedAutoBiometricUnlock ||
      this.isUnlocked ||
      !this.hasMasterPassword ||
      !this.biometricUnlockAvailable ||
      this.isBiometricAuthenticating) {
      return;
    }

    this.hasTriedAutoBiometricUnlock = true;
    this.handleBiometricUnlock(true);
  }

  private syncState(): void {
    let service: UnlockService = UnlockService.getInstance();
    let context: common.UIAbilityContext = this.getHostContext();
    let state: UnlockState = service.readState(context);
    this.biometricUnlockAvailable = service.isBiometricUnlockAvailable(context);
    this.applyState(state);
  }

  private applyState(state: UnlockState): void {
    this.hasMasterPassword = state.hasMasterPassword;
    this.isUnlocked = state.isUnlocked;
    if (state.isUnlocked) {
      this.errorMessage = '';
    }
  }

  private getHostContext(): common.UIAbilityContext {
    return this.getUIContext().getHostContext() as common.UIAbilityContext;
  }

  private resolveHeaderHeight(): number {
    return 76;
  }

  private appString(resource: Resource, fallback: string): string {
    return AppI18n.string(this.getHostContext(), resource, fallback);
  }

  private appFormat(resource: Resource, fallback: string, ...args: Array<string | number>): string {
    return AppI18n.format(this.getHostContext(), resource, fallback, ...args);
  }

}
