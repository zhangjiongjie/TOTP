import { common } from '@kit.AbilityKit';
import { UnlockService, UnlockState } from '../services/UnlockService';

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
      Text('解锁保管库')
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
      Text('主密码')
        .fontSize(17)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))
        .width('100%')

      Text(this.hasMasterPassword ? '请输入已保存的主密码' : '首次输入会初始化当前设备的主密码')
        .fontSize(13)
        .fontColor($r('sys.color.font_secondary'))
        .width('100%')

      TextInput({
        placeholder: this.hasMasterPassword ? '输入主密码' : '设置主密码',
        text: this.password
      })
        .type(InputType.Password)
        .fontSize(16)
        .fontColor($r('sys.color.font_primary'))
        .placeholderColor('#97A3B5')
        .backgroundColor($r('sys.color.comp_background_gray'))
        .borderRadius(18)
        .height(52)
        .padding({ left: 16, right: 16 })
        .onChange((value: string) => {
          this.password = value;
        })

      Button('解锁')
        .type(ButtonType.Capsule)
        .width('100%')
        .height(48)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(Color.White)
        .backgroundColor('#215C98')
        .onClick(() => {
          this.handlePasswordUnlock();
        })

      if (this.biometricUnlockAvailable) {
        Button(this.isBiometricAuthenticating ? '验证中...' : '人脸 / 指纹解锁')
          .type(ButtonType.Capsule)
          .width('100%')
          .height(46)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor('#215C98')
          .backgroundColor($r('sys.color.comp_background_gray'))
          .enabled(!this.isBiometricAuthenticating)
          .onClick(() => {
            this.handleBiometricUnlock();
          })
      }

      if (this.errorMessage.length > 0) {
        Text(this.errorMessage)
          .fontSize(13)
          .lineHeight(20)
          .fontColor('#C53D3D')
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
      this.errorMessage = message.length > 0 ? message : '解锁失败，请稍后重试。';
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
      this.errorMessage = '正在启动人脸 / 指纹验证，也可以使用主密码解锁。';
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
      let fallbackMessage: string = message.length > 0 ? message : '生物识别解锁失败，请使用主密码。';
      this.errorMessage = autoTriggered ? `${fallbackMessage} 可继续使用主密码解锁。` : fallbackMessage;
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

}
