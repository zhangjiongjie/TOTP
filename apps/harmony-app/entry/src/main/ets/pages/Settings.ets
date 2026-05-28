import { common } from '@kit.AbilityKit';
import { LocalVault } from '../model/LocalVault';
import { DEFAULT_WEBDAV_FILE_PATH, WebDavSettings } from '../model/WebDavSettings';
import { ExportVaultResult, ImportVaultResult, SettingsService, WebDavSettingsDraft } from '../services/SettingsService';
import { WebDavSyncResult, WebDavSyncService } from '../services/WebDavSyncService';
import { MasterPasswordChangeResultPolicy } from '../services/MasterPasswordChangeResultPolicy';

@Component
export struct Settings {
  syncStatusMessage: string = '';
  copyStatusMessage: string = '';
  lastUpdatedLabel: string = '';
  bottomInset: number = 116;
  topInset: number = 0;
  onSaved: (message: string) => void = (_message: string) => {};
  onImported: (vault: LocalVault, message: string) => void = (_vault: LocalVault, _message: string) => {};
  onPasswordChanged: (vault: LocalVault, message: string) => void = (_vault: LocalVault, _message: string) => {};

  @State private webDavEnabled: boolean = false;
  @State private serverUrl: string = '';
  @State private filePath: string = DEFAULT_WEBDAV_FILE_PATH;
  @State private username: string = '';
  @State private password: string = '';
  @State private syncIntervalMinutes: string = '15';
  @State private biometricUnlockEnabled: boolean = false;
  @State private securityStatusMessage: string = '';
  @State private securityErrorMessage: string = '';
  @State private showChangePasswordDialog: boolean = false;
  @State private currentMasterPassword: string = '';
  @State private nextMasterPassword: string = '';
  @State private confirmMasterPassword: string = '';
  @State private isPasswordChanging: boolean = false;
  @State private passwordChangeMessage: string = '';
  @State private passwordChangeIsError: boolean = false;
  @State private webDavStatusMessage: string = '';
  @State private webDavErrorMessage: string = '';
  @State private backupStatusMessage: string = '';
  @State private backupErrorMessage: string = '';
  @State private isBackupBusy: boolean = false;
  private service: SettingsService = SettingsService.getInstance();

  aboutToAppear(): void {
    this.loadSettings();
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Scroll() {
        Column({ space: 14 }) {
          Blank()
            .height(this.topInset)
          this.buildSecurityCard()
          this.buildMasterPasswordCard()
          this.buildWebDavCard()
          this.buildBackupCard()
          Blank()
            .height(this.bottomInset + 32)
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 6, bottom: 24 })
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Auto)
      if (this.showChangePasswordDialog || this.passwordChangeMessage.length > 0 || this.isPasswordChanging) {
        this.buildChangeMasterPasswordDialog()
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  @Builder
  private buildMasterPasswordCard(): void {
    Row() {
      Column({ space: 6 }) {
        Text('主密码')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('sys.color.font_primary'))

        Text('修改后会重新保护保管库密钥，账号数据密钥保持不变。')
          .fontSize(13)
          .lineHeight(20)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Button('修改')
        .height(36)
        .enabled(!this.isPasswordChanging)
        .backgroundColor(Color.Transparent)
        .fontColor('#2878C8')
        .onClick(() => {
          let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
          if (this.service.isRemotePasswordBlocked(context)) {
            this.webDavErrorMessage = '远端保管库需要主密码验证后才能继续同步，请先验证远端主密码。';
            return;
          }
          this.currentMasterPassword = '';
          this.nextMasterPassword = '';
          this.confirmMasterPassword = '';
          this.passwordChangeMessage = '';
          this.passwordChangeIsError = false;
          this.showChangePasswordDialog = true;
        })
    }
    .width('100%')
    .padding(20)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(28)
  }

  @Builder
  private buildChangeMasterPasswordDialog(): void {
    Stack({ alignContent: Alignment.Top }) {
      Scroll() {
        Column() {
          Column({ space: 12 }) {
            if (this.isPasswordChanging || this.passwordChangeMessage.length > 0) {
              if (this.isPasswordChanging) {
                LoadingProgress()
                  .width(36)
                  .height(36)
              }
              Text(this.passwordChangeMessage.length > 0 ? this.passwordChangeMessage : '正在更新主密码...')
                .fontSize(15)
                .lineHeight(22)
                .fontColor(this.passwordChangeIsError ? '#C53D3D' : $r('sys.color.font_primary'))
            } else {
              Text('修改主密码')
                .fontSize(20)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('sys.color.font_primary'))
                .width('100%')

              this.buildInput('当前主密码', '当前主密码', this.currentMasterPassword, (value: string) => {
                this.currentMasterPassword = value;
              }, true)
              this.buildInput('新主密码', '新主密码', this.nextMasterPassword, (value: string) => {
                this.nextMasterPassword = value;
              }, true)
              this.buildInput('再次输入新主密码', '再次输入新主密码', this.confirmMasterPassword, (value: string) => {
                this.confirmMasterPassword = value;
              }, true)

              Row({ space: 10 }) {
                Button('取消')
                  .height(42)
                  .layoutWeight(1)
                  .backgroundColor($r('sys.color.comp_background_gray'))
                  .fontColor($r('sys.color.font_primary'))
                  .onClick(() => {
                    this.showChangePasswordDialog = false;
                  })

                Button('保存')
                  .height(42)
                  .layoutWeight(1)
                  .backgroundColor('#2878C8')
                  .fontColor(Color.White)
                  .onClick(() => {
                    this.changeMasterPassword();
                  })
              }
              .width('100%')
            }
          }
          .width('86%')
          .padding(22)
          .backgroundColor($r('app.color.dialog_surface'))
          .border({ width: 1, color: $r('app.color.dialog_border') })
          .borderRadius(26)
          .shadow({ radius: 28, color: '#52000000', offsetX: 0, offsetY: 14 })
          .alignItems(HorizontalAlign.Center)
          .margin({ top: 44, bottom: 180 })
        }
        .width('100%')
        .alignItems(HorizontalAlign.Center)
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Auto)
    }
    .width('100%')
    .height('100%')
    .backdropBlur(18)
    .backgroundColor($r('app.color.dialog_overlay'))
  }

  @Builder
  private buildSecurityCard(): void {
    Row() {
      Column({ space: 6 }) {
        Text('生物识别解锁')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('sys.color.font_primary'))

        Text('开启后可用人脸或指纹解锁。')
          .fontSize(13)
          .lineHeight(20)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')

        if (this.securityStatusMessage.length > 0) {
          this.buildInlineMessage(this.securityStatusMessage, false)
        }

        if (this.securityErrorMessage.length > 0) {
          this.buildInlineMessage(this.securityErrorMessage, true)
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: this.biometricUnlockEnabled })
        .onChange((value: boolean) => {
          this.saveBiometricUnlockEnabled(value);
        })
    }
    .width('100%')
    .padding(20)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(28)
  }

  @Builder
  private buildWebDavCard(): void {
    Column({ space: 14 }) {
      Row() {
        Column({ space: 6 }) {
          Text('WebDAV 同步')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('sys.color.font_primary'))

          if (this.resolveWebDavStatusMessage().length > 0) {
            this.buildInlineMessage(this.resolveWebDavStatusMessage(), false)
          }

          if (this.resolveWebDavErrorMessage().length > 0) {
            this.buildInlineMessage(this.resolveWebDavErrorMessage(), true)
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Column({ space: 4 }) {
          Checkbox({ name: 'webdav-enabled' })
            .select(this.webDavEnabled)
            .shape(CheckBoxShape.ROUNDED_SQUARE)
            .selectedColor('#1E5AA8')
            .unselectedColor($r('sys.color.comp_background_gray'))
            .width(28)
            .height(28)
            .onChange((value: boolean) => {
              this.handleWebDavEnabledChange(value);
            })

          Text(this.webDavEnabled ? '已启用' : '未启用')
            .fontSize(11)
            .fontColor($r('sys.color.font_secondary'))
        }
        .alignItems(HorizontalAlign.Center)
        .margin({ left: 12 })
      }
      .width('100%')

      if (!this.webDavEnabled) {
        Text('勾选后立即保存并启用同步。')
          .fontSize(12)
          .lineHeight(18)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      }

      this.buildInput('服务器地址', 'https://example.com/dav', this.serverUrl, (value: string) => {
        this.serverUrl = value;
      })
      this.buildInput('保管库路径', DEFAULT_WEBDAV_FILE_PATH, this.filePath, (value: string) => {
        this.filePath = value;
      })
      this.buildInput('用户名', 'WebDAV 用户名', this.username, (value: string) => {
        this.username = value;
      })
      this.buildInput('密码', '密码', this.password, (value: string) => {
        this.password = value;
      }, true)
      this.buildInput('自动同步间隔（分钟）', '15', this.syncIntervalMinutes, (value: string) => {
        this.syncIntervalMinutes = value;
      })
    }
    .width('100%')
    .padding(20)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(28)
  }

  @Builder
  private buildBackupCard(): void {
    Column({ space: 14 }) {
      Row() {
        Text('导入 / 导出')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('sys.color.font_primary'))
          .layoutWeight(1)

        Row({ space: 12 }) {
          this.buildBackupIconButton($r('app.media.backup_export'), () => {
            this.exportBackup();
          })
          this.buildBackupIconButton($r('app.media.backup_import'), () => {
            this.importBackup();
          })
        }
      }
      .width('100%')

      if (this.backupStatusMessage.length > 0) {
        this.buildInlineMessage(this.backupStatusMessage, false)
      }

      if (this.backupErrorMessage.length > 0) {
        this.buildInlineMessage(this.backupErrorMessage, true)
      }
    }
    .width('100%')
    .padding(20)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(28)
  }

  @Builder
  private buildBackupIconButton(icon: Resource, onClick: () => void): void {
    Button() {
      Image(icon)
        .width(22)
        .height(22)
        .objectFit(ImageFit.Contain)
    }
    .width(44)
    .height(44)
    .type(ButtonType.Circle)
    .backgroundColor($r('sys.color.comp_background_gray'))
    .border({ width: 1, color: $r('sys.color.comp_background_tertiary') })
    .enabled(!this.isBackupBusy)
    .opacity(this.isBackupBusy ? 0.45 : 1)
    .onClick(() => {
      onClick();
    })
  }

  @Builder
  private buildInlineMessage(message: string, isError: boolean): void {
    Text(message)
      .fontSize(13)
      .lineHeight(20)
      .fontColor(isError ? '#C53D3D' : $r('sys.color.font_secondary'))
      .width('100%')
  }

  @Builder
  private buildInput(
    label: string,
    placeholder: string,
    textValue: string,
    onChanged: (value: string) => void,
    isPassword: boolean = false
  ): void {
    Column({ space: 8 }) {
      Text(label)
        .fontSize(14)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))
        .width('100%')

      TextInput({ text: textValue, placeholder: placeholder })
        .type(isPassword ? InputType.Password : InputType.Normal)
        .height(46)
        .fontSize(15)
        .fontColor($r('sys.color.font_primary'))
        .placeholderColor('#8FA0B8')
        .backgroundColor($r('sys.color.comp_background_gray'))
        .borderRadius(16)
        .padding({ left: 14, right: 14 })
        .onChange((value: string) => {
          onChanged(value);
        })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  private loadSettings(): void {
    this.webDavErrorMessage = '';
    this.webDavStatusMessage = '';
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let settings: WebDavSettings = this.service.loadWebDavSettings(context);
      this.applySettings(settings);
      this.biometricUnlockEnabled = this.service.loadBiometricUnlockEnabled(context);
    } catch (error) {
      this.webDavErrorMessage = this.readErrorMessage(error, '读取设置失败，请稍后重试。');
    }
  }

  private handleWebDavEnabledChange(enabled: boolean): void {
    if (enabled && !this.hasRequiredWebDavFields()) {
      this.webDavEnabled = false;
      this.webDavStatusMessage = '';
      this.webDavErrorMessage = '请先填写 WebDAV 服务器地址。';
      return;
    }
    this.saveWebDavSettings(enabled);
  }

  private async saveWebDavSettings(enabled: boolean): Promise<void> {
    this.webDavErrorMessage = '';
    this.webDavStatusMessage = '';
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let draft: WebDavSettingsDraft = {
        enabled: enabled,
        serverUrl: this.serverUrl,
        filePath: this.filePath,
        username: this.username,
        password: this.password,
        syncIntervalMinutes: this.parsePositiveNumber(this.syncIntervalMinutes, 15)
      };
      let settings: WebDavSettings = this.service.saveWebDavSettings(context, draft);
      this.applySettings(settings);
      let message: string = settings.enabled ? '已启用 WebDAV 同步' : 'WebDAV 同步未开启，本地模式。';
      if (settings.enabled) {
        let syncResult: WebDavSyncResult = await WebDavSyncService.getInstance().syncNow(context);
        message = syncResult.message;
        if (syncResult.status === 'blocked' || syncResult.status === 'conflict') {
          this.webDavErrorMessage = syncResult.message;
          this.webDavStatusMessage = '';
        } else {
          this.webDavErrorMessage = '';
          this.webDavStatusMessage = syncResult.message;
        }
      } else {
        this.webDavErrorMessage = '';
        this.webDavStatusMessage = 'WebDAV 同步未开启，本地模式。';
      }
      this.onSaved(message);
    } catch (error) {
      this.webDavEnabled = !enabled;
      this.webDavErrorMessage = this.readErrorMessage(error, '保存设置失败，请稍后重试。');
    }
  }

  private async saveBiometricUnlockEnabled(enabled: boolean): Promise<void> {
    this.securityErrorMessage = '';
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.biometricUnlockEnabled = await this.service.saveBiometricUnlockEnabled(context, enabled);
      this.securityStatusMessage = this.biometricUnlockEnabled ? '已开启生物识别解锁' : '已关闭生物识别解锁';
    } catch (error) {
      this.biometricUnlockEnabled = !enabled;
      this.securityErrorMessage = this.readErrorMessage(error, '保存生物识别设置失败，请稍后重试。');
    }
  }

  private async changeMasterPassword(): Promise<void> {
    if (this.currentMasterPassword.trim().length === 0 || this.nextMasterPassword.trim().length === 0) {
      this.passwordChangeMessage = '请输入当前主密码和新主密码。';
      this.passwordChangeIsError = true;
      setTimeout(() => {
        this.passwordChangeMessage = '';
      }, 1600);
      return;
    }
    if (this.nextMasterPassword !== this.confirmMasterPassword) {
      this.passwordChangeMessage = '两次输入的新主密码不一致。';
      this.passwordChangeIsError = true;
      setTimeout(() => {
        this.passwordChangeMessage = '';
      }, 1600);
      return;
    }
    this.isPasswordChanging = true;
    this.passwordChangeMessage = '正在更新主密码...';
    this.passwordChangeIsError = false;
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let result: WebDavSyncResult = await this.service.changeMasterPassword(context, this.currentMasterPassword, this.nextMasterPassword);
      this.biometricUnlockEnabled = this.service.loadBiometricUnlockEnabled(context);
      this.passwordChangeMessage = MasterPasswordChangeResultPolicy.resolveSuccessMessage(result);
      let changedVault: LocalVault | undefined = MasterPasswordChangeResultPolicy.resolveChangedVault(result);
      if (changedVault !== undefined) {
        this.onPasswordChanged(changedVault, this.passwordChangeMessage);
      }
      this.passwordChangeIsError = false;
      setTimeout(() => {
        this.showChangePasswordDialog = false;
        this.passwordChangeMessage = '';
      }, 1600);
    } catch (error) {
      this.passwordChangeMessage = this.normalizePasswordChangeError(error);
      this.passwordChangeIsError = true;
      setTimeout(() => {
        this.showChangePasswordDialog = false;
        this.passwordChangeMessage = '';
      }, 1600);
    } finally {
      this.isPasswordChanging = false;
    }
  }

  private normalizePasswordChangeError(error: Object): string {
    let message: string = this.readErrorMessage(error, '主密码修改失败');
    if (message.indexOf('解密') >= 0 || message.indexOf('decrypt') >= 0 || message.indexOf('GCM') >= 0) {
      return '当前主密码错误';
    }
    return message;
  }

  private async exportBackup(): Promise<void> {
    if (this.isBackupBusy) {
      return;
    }
    this.backupErrorMessage = '';
    this.isBackupBusy = true;
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let result: ExportVaultResult = await this.service.exportVault(context);
      this.backupStatusMessage = `已导出 ${result.exportedCount} 个账号：${result.filename}`;
    } catch (error) {
      this.backupErrorMessage = this.readErrorMessage(error, '导出备份失败，请稍后重试。');
    } finally {
      this.isBackupBusy = false;
    }
  }

  private async importBackup(): Promise<void> {
    if (this.isBackupBusy) {
      return;
    }
    this.backupErrorMessage = '';
    this.isBackupBusy = true;
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let result: ImportVaultResult = await this.service.importVault(context);
      let message: string = `已导入 ${result.importedCount} 个账号`;
      this.backupStatusMessage = message;
      this.onImported(result.vault, message);
    } catch (error) {
      this.backupErrorMessage = this.readErrorMessage(error, '导入备份失败，请稍后重试。');
    } finally {
      this.isBackupBusy = false;
    }
  }

  private applySettings(settings: WebDavSettings): void {
    this.webDavEnabled = settings.enabled;
    this.serverUrl = settings.serverUrl;
    this.filePath = settings.filePath;
    this.username = settings.username;
    this.password = settings.password;
    this.syncIntervalMinutes = `${settings.syncIntervalMinutes}`;
    if (settings.updatedAt.length > 0 && this.webDavStatusMessage.length === 0 && this.webDavErrorMessage.length === 0) {
      this.webDavStatusMessage = `已保存 ${this.formatDateLabel(settings.updatedAt)}`;
    }
  }

  private resolveWebDavStatusMessage(): string {
    if (!this.webDavEnabled) {
      return 'WebDAV 同步未开启，本地模式。';
    }
    if (this.webDavEnabled &&
      this.isUsefulSyncStatusMessage(this.syncStatusMessage) &&
      !this.isRemotePasswordMessage(this.syncStatusMessage)) {
      return this.syncStatusMessage;
    }
    return this.webDavStatusMessage;
  }

  private resolveWebDavErrorMessage(): string {
    if (this.webDavEnabled && this.isRemotePasswordMessage(this.syncStatusMessage)) {
      return this.syncStatusMessage;
    }
    if (this.isRemotePasswordMessage(this.webDavErrorMessage) &&
      this.webDavEnabled &&
      (this.isSuccessfulWebDavMessage(this.syncStatusMessage) ||
        this.isSuccessfulWebDavMessage(this.webDavStatusMessage))) {
      return '';
    }
    return this.webDavErrorMessage;
  }

  private isUsefulSyncStatusMessage(message: string): boolean {
    return message.length > 0 &&
      message !== '未配置 WebDAV，数据仅保留在本机。' &&
      message !== '同步中...' &&
      message.indexOf('已关闭 WebDAV 同步') < 0;
  }

  private isRemotePasswordMessage(message: string): boolean {
    return message.indexOf('远端保管库需要主密码验证') >= 0;
  }

  private isSuccessfulWebDavMessage(message: string): boolean {
    if (message.length === 0 || this.isRemotePasswordMessage(message)) {
      return false;
    }
    return message.indexOf('已同步') >= 0 ||
      message.indexOf('已是最新') >= 0 ||
      message.indexOf('已从 WebDAV') >= 0 ||
      message.indexOf('本地与 WebDAV') >= 0 ||
      message.indexOf('同步基线已刷新') >= 0 ||
      message.indexOf('主密码已修改并同步到 WebDAV') >= 0 ||
      message.indexOf('本地修改已同步到 WebDAV') >= 0 ||
      message.indexOf('本地变更已同步到 WebDAV') >= 0 ||
      message.indexOf('自动合并并同步到 WebDAV') >= 0;
  }

  private hasRequiredWebDavFields(): boolean {
    return this.serverUrl.trim().length > 0;
  }

  private parsePositiveNumber(value: string, fallback: number): number {
    let parsed: number = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private readErrorMessage(error: Object, fallback: string): string {
    let errorObject: Error = error as Error;
    if (errorObject && errorObject.message && errorObject.message.length > 0) {
      return errorObject.message;
    }
    return fallback;
  }

  private formatDateLabel(isoText: string): string {
    let date: Date = new Date(isoText);
    if (isNaN(date.getTime())) {
      return isoText;
    }

    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())} ${this.pad(date.getHours())}:${this.pad(date.getMinutes())}`;
  }

  private pad(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}
