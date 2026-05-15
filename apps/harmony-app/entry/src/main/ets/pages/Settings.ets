import { common } from '@kit.AbilityKit';
import { LocalVault } from '../model/LocalVault';
import { DEFAULT_WEBDAV_FILE_PATH, WebDavSettings } from '../model/WebDavSettings';
import { ExportVaultResult, ImportVaultResult, SettingsService, WebDavSettingsDraft } from '../services/SettingsService';

@Component
export struct Settings {
  syncStatusMessage: string = '';
  copyStatusMessage: string = '';
  lastUpdatedLabel: string = '';
  bottomInset: number = 116;
  topInset: number = 0;
  onSaved: (message: string) => void = (_message: string) => {};
  onImported: (vault: LocalVault, message: string) => void = (_vault: LocalVault, _message: string) => {};

  @State private webDavEnabled: boolean = false;
  @State private serverUrl: string = '';
  @State private filePath: string = DEFAULT_WEBDAV_FILE_PATH;
  @State private username: string = '';
  @State private password: string = '';
  @State private syncIntervalMinutes: string = '15';
  @State private biometricUnlockEnabled: boolean = false;
  @State private securityStatusMessage: string = '';
  @State private securityErrorMessage: string = '';
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
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('sys.color.ohos_id_color_background'))
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

          if (this.webDavStatusMessage.length > 0) {
            this.buildInlineMessage(this.webDavStatusMessage, false)
          }

          if (this.webDavErrorMessage.length > 0) {
            this.buildInlineMessage(this.webDavErrorMessage, true)
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

  private saveWebDavSettings(enabled: boolean): void {
    this.webDavErrorMessage = '';
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
      let message: string = settings.enabled ? '已启用 WebDAV 同步' : '已关闭 WebDAV 同步';
      this.webDavStatusMessage = message;
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
    if (settings.updatedAt.length > 0) {
      this.webDavStatusMessage = `已保存 ${this.formatDateLabel(settings.updatedAt)}`;
    }
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
