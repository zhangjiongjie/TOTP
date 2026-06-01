import { common } from '@kit.AbilityKit';
import { LocalVault } from '../model/LocalVault';
import { DEFAULT_WEBDAV_FILE_PATH, WebDavSettings } from '../model/WebDavSettings';
import { ExportVaultResult, ImportVaultResult, ImportVaultSelection, SettingsService, WebDavSettingsDraft } from '../services/SettingsService';
import { WebDavSyncResult, WebDavSyncService } from '../services/WebDavSyncService';
import { WebDavSettingsSaveOutcome, WebDavSettingsSaveResultPolicy } from '../policies/WebDavSettingsSaveResultPolicy';
import { MasterPasswordChangeResultPolicy } from '../policies/MasterPasswordChangeResultPolicy';
import { InlineMessageState, TransientInlineMessagePolicy } from '../policies/TransientInlineMessagePolicy';
import { ImportBackupPasswordPromptPolicy } from '../policies/ImportBackupPasswordPromptPolicy';
import { AppI18n } from '../utils/AppI18n';

const BACKUP_MESSAGE_VISIBLE_MS: number = 2500;

@Component
export struct Settings {
  syncStatusMessage: string = '';
  copyStatusMessage: string = '';
  lastUpdatedLabel: string = '';
  bottomInset: number = 116;
  topInset: number = 0;
  onSaved: (message: string, vault: LocalVault | undefined, alreadySynced: boolean) => void = (_message: string, _vault: LocalVault | undefined, _alreadySynced: boolean) => {};
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
  @State private backupMessageVersion: number = 0;
  @State private isBackupBusy: boolean = false;
  @State private showImportPasswordDialog: boolean = false;
  @State private importBackupPassword: string = '';
  @State private importPasswordErrorMessage: string = '';
  @State private pendingImportSelection: ImportVaultSelection | undefined = undefined;
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
      if (this.showImportPasswordDialog) {
        this.buildImportPasswordDialog()
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
        Text($r('app.string.settings_master_password_title'))
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('sys.color.font_primary'))

        Text($r('app.string.settings_master_password_body'))
          .fontSize(13)
          .lineHeight(20)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Button($r('app.string.settings_password_change_button'))
        .height(36)
        .enabled(!this.isPasswordChanging)
        .backgroundColor(Color.Transparent)
        .fontColor($r('app.color.color_primary'))
        .onClick(() => {
          let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
          if (this.service.isRemotePasswordBlocked(context)) {
            this.webDavErrorMessage = this.appString($r('app.string.webdav_remote_password_blocked_with_hint'), 'Verify the remote vault master password before continuing sync.');
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
              Text(this.passwordChangeMessage.length > 0 ? this.passwordChangeMessage : $r('app.string.settings_updating_master_password'))
                .fontSize(15)
                .lineHeight(22)
                .fontColor(this.passwordChangeIsError ? $r('app.color.color_danger') : $r('sys.color.font_primary'))
            } else {
              Text($r('app.string.settings_change_password_title'))
                .fontSize(20)
                .fontWeight(FontWeight.Bold)
                .fontColor($r('sys.color.font_primary'))
                .width('100%')

              this.buildInput($r('app.string.settings_current_password'), $r('app.string.settings_current_password'), this.currentMasterPassword, (value: string) => {
                this.currentMasterPassword = value;
              }, true)
              this.buildInput($r('app.string.settings_new_password'), $r('app.string.settings_new_password'), this.nextMasterPassword, (value: string) => {
                this.nextMasterPassword = value;
              }, true)
              this.buildInput($r('app.string.settings_repeat_new_password'), $r('app.string.settings_repeat_new_password'), this.confirmMasterPassword, (value: string) => {
                this.confirmMasterPassword = value;
              }, true)

              Row({ space: 10 }) {
                Button($r('app.string.action_cancel'))
                  .height(42)
                  .layoutWeight(1)
                  .backgroundColor($r('app.color.color_control_surface'))
                  .fontColor($r('sys.color.font_primary'))
                  .onClick(() => {
                    this.showChangePasswordDialog = false;
                  })

                Button($r('app.string.action_save'))
                  .height(42)
                  .layoutWeight(1)
                  .backgroundColor($r('app.color.color_primary'))
                  .fontColor($r('sys.color.ohos_id_color_foreground_contrary'))
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
          .shadow({ radius: 28, color: $r('app.color.color_dialog_shadow'), offsetX: 0, offsetY: 14 })
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
        Text($r('app.string.settings_biometric_title'))
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('sys.color.font_primary'))

        Text($r('app.string.settings_biometric_body'))
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
          Text($r('app.string.settings_webdav_title'))
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
            .selectedColor($r('app.color.color_primary'))
            .unselectedColor($r('app.color.color_checkbox_unselected_outline'))
            .width(28)
            .height(28)
            .onChange((value: boolean) => {
              this.handleWebDavEnabledChange(value);
            })

          Text(this.webDavEnabled ? $r('app.string.settings_webdav_enabled') : $r('app.string.settings_webdav_not_enabled'))
            .fontSize(11)
            .fontColor($r('sys.color.font_secondary'))
        }
        .alignItems(HorizontalAlign.Center)
        .margin({ left: 12 })
      }
      .width('100%')

      if (!this.webDavEnabled) {
        Text($r('app.string.settings_webdav_enable_hint'))
          .fontSize(12)
          .lineHeight(18)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      }

      this.buildInput($r('app.string.settings_webdav_server'), 'https://example.com/dav', this.serverUrl, (value: string) => {
        this.serverUrl = value;
      })
      this.buildInput($r('app.string.settings_webdav_file_path'), DEFAULT_WEBDAV_FILE_PATH, this.filePath, (value: string) => {
        this.filePath = value;
      })
      this.buildInput($r('app.string.settings_webdav_username'), $r('app.string.settings_webdav_username'), this.username, (value: string) => {
        this.username = value;
      })
      this.buildInput($r('app.string.settings_webdav_password'), $r('app.string.settings_webdav_password'), this.password, (value: string) => {
        this.password = value;
      }, true)
      this.buildInput($r('app.string.settings_webdav_interval'), '15', this.syncIntervalMinutes, (value: string) => {
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
        Text($r('app.string.settings_backup_title'))
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
    .backgroundColor($r('app.color.color_control_surface'))
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
      .fontColor(isError ? $r('app.color.color_danger') : $r('sys.color.font_secondary'))
      .width('100%')
  }

  @Builder
  private buildInput(
    label: ResourceStr,
    placeholder: ResourceStr,
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
        .placeholderColor($r('app.color.color_placeholder'))
        .backgroundColor($r('app.color.color_control_surface'))
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
      this.webDavErrorMessage = this.readErrorMessage(error, this.appString($r('app.string.error_settings_load_failed'), 'Failed to load settings. Please try again later.'));
    }
  }

  private handleWebDavEnabledChange(enabled: boolean): void {
    if (enabled && !this.hasRequiredWebDavFields()) {
      this.webDavEnabled = false;
      this.webDavStatusMessage = '';
      this.webDavErrorMessage = this.appString($r('app.string.error_webdav_server_required'), 'Enter the WebDAV server URL first.');
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
      let syncResult: WebDavSyncResult | undefined = undefined;
      if (settings.enabled) {
        syncResult = await WebDavSyncService.getInstance().syncNow(context);
        if (syncResult.status === 'blocked' || syncResult.status === 'conflict') {
          this.webDavErrorMessage = syncResult.message;
          this.webDavStatusMessage = '';
        } else {
          this.webDavErrorMessage = '';
          this.webDavStatusMessage = syncResult.message;
        }
      } else {
        this.webDavErrorMessage = '';
        this.webDavStatusMessage = this.appString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.');
      }
      let outcome: WebDavSettingsSaveOutcome = WebDavSettingsSaveResultPolicy.resolve(settings.enabled, syncResult);
      this.onSaved(outcome.message, outcome.syncedVault, outcome.alreadySynced);
    } catch (error) {
      this.webDavEnabled = !enabled;
      this.webDavErrorMessage = this.readErrorMessage(error, this.appString($r('app.string.error_settings_save_failed'), 'Failed to save settings. Please try again later.'));
    }
  }

  private async saveBiometricUnlockEnabled(enabled: boolean): Promise<void> {
    this.securityErrorMessage = '';
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.biometricUnlockEnabled = await this.service.saveBiometricUnlockEnabled(context, enabled);
      this.securityStatusMessage = this.biometricUnlockEnabled
        ? this.appString($r('app.string.settings_biometric_enabled'), 'Biometric unlock is on')
        : this.appString($r('app.string.settings_biometric_disabled'), 'Biometric unlock is off');
    } catch (error) {
      this.biometricUnlockEnabled = !enabled;
      this.securityErrorMessage = this.readErrorMessage(error, this.appString($r('app.string.settings_biometric_save_failed'), 'Failed to save biometric settings. Please try again later.'));
    }
  }

  private async changeMasterPassword(): Promise<void> {
    if (this.currentMasterPassword.trim().length === 0 || this.nextMasterPassword.trim().length === 0) {
      this.passwordChangeMessage = this.appString($r('app.string.error_master_password_required'), 'Enter the current master password and a new master password.');
      this.passwordChangeIsError = true;
      setTimeout(() => {
        this.passwordChangeMessage = '';
      }, 1600);
      return;
    }
    if (this.nextMasterPassword !== this.confirmMasterPassword) {
      this.passwordChangeMessage = this.appString($r('app.string.error_new_password_mismatch'), 'The new passwords do not match.');
      this.passwordChangeIsError = true;
      setTimeout(() => {
        this.passwordChangeMessage = '';
      }, 1600);
      return;
    }
    this.isPasswordChanging = true;
    this.passwordChangeMessage = this.appString($r('app.string.settings_updating_master_password'), 'Updating master password...');
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
    let message: string = this.readErrorMessage(error, this.appString($r('app.string.error_master_password_change_failed'), 'Failed to change master password'));
    if (message.indexOf('解密') >= 0 || message.indexOf('decrypt') >= 0 || message.indexOf('GCM') >= 0) {
      return this.appString($r('app.string.error_current_master_password_wrong'), 'Current master password is incorrect');
    }
    return message;
  }

  private async exportBackup(): Promise<void> {
    if (this.isBackupBusy) {
      return;
    }
    this.applyBackupMessage(new InlineMessageState('', '', this.backupMessageVersion));
    this.isBackupBusy = true;
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let result: ExportVaultResult = await this.service.exportVault(context);
      this.showBackupStatus(this.appFormat($r('app.string.backup_exported_count'), 'Exported %1$d accounts: %2$s', result.exportedCount, result.filename));
    } catch (error) {
      this.showBackupError(this.readErrorMessage(error, this.appString($r('app.string.error_backup_export_failed'), 'Export failed. Please try again later.')));
    } finally {
      this.isBackupBusy = false;
    }
  }

  @Builder
  private buildImportPasswordDialog(): void {
    Stack({ alignContent: Alignment.Top }) {
      Scroll() {
        Column() {
          Column({ space: 12 }) {
            Text($r('app.string.settings_backup_import_title'))
              .fontSize(20)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('sys.color.font_primary'))
              .width('100%')

            Text($r('app.string.settings_backup_import_password_body'))
              .fontSize(14)
              .lineHeight(21)
              .fontColor($r('sys.color.font_secondary'))
              .width('100%')

            this.buildInput($r('app.string.settings_backup_import_password_label'), $r('app.string.settings_backup_import_password_label'), this.importBackupPassword, (value: string) => {
              this.importBackupPassword = value;
              this.importPasswordErrorMessage = '';
            }, true)

            if (this.importPasswordErrorMessage.length > 0) {
              Text(this.importPasswordErrorMessage)
                .fontSize(13)
                .lineHeight(20)
                .fontColor($r('app.color.color_danger'))
                .width('100%')
            }

            Row({ space: 10 }) {
              Button($r('app.string.action_cancel'))
                .height(42)
                .layoutWeight(1)
                .backgroundColor($r('app.color.color_control_surface'))
                .fontColor($r('sys.color.font_primary'))
                .onClick(() => {
                  this.dismissImportPasswordDialog();
                })

              Button($r('app.string.action_import'))
                .height(42)
                .layoutWeight(1)
                .backgroundColor($r('app.color.color_primary'))
                .fontColor($r('sys.color.ohos_id_color_foreground_contrary'))
                .enabled(!this.isBackupBusy)
                .onClick(() => {
                  this.retryImportBackupWithPassword();
                })
            }
            .width('100%')
          }
          .width('86%')
          .padding(22)
          .backgroundColor($r('app.color.dialog_surface'))
          .border({ width: 1, color: $r('app.color.dialog_border') })
          .borderRadius(26)
          .shadow({ radius: 28, color: $r('app.color.color_dialog_shadow'), offsetX: 0, offsetY: 14 })
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

  private async importBackup(): Promise<void> {
    if (this.isBackupBusy) {
      return;
    }
    this.applyBackupMessage(new InlineMessageState('', '', this.backupMessageVersion));
    this.isBackupBusy = true;
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let selection: ImportVaultSelection = await this.service.selectImportVault(context);
      this.pendingImportSelection = selection;
      this.importBackupPassword = '';
      this.importPasswordErrorMessage = '';
      this.finishSelectedImport(context, selection);
    } catch (error) {
      this.showBackupError(this.readErrorMessage(error, this.appString($r('app.string.error_backup_import_failed'), 'Import failed. Please try again later.')));
      this.isBackupBusy = false;
    }
  }

  private retryImportBackupWithPassword(): void {
    if (this.isBackupBusy) {
      return;
    }
    let password: string = this.importBackupPassword.trim();
    if (password.length === 0) {
      this.importPasswordErrorMessage = this.appString($r('app.string.settings_import_password_required'), 'Enter the backup file password.');
      return;
    }
    let selection: ImportVaultSelection | undefined = this.pendingImportSelection;
    if (selection === undefined) {
      this.dismissImportPasswordDialog();
      this.showBackupError(this.appString($r('app.string.error_import_no_file'), 'No import file selected.'));
      return;
    }
    this.isBackupBusy = true;
    let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.finishSelectedImport(context, selection, password);
  }

  private finishSelectedImport(context: common.UIAbilityContext, selection: ImportVaultSelection, importPassword: string | undefined = undefined): void {
    try {
      let result: ImportVaultResult = this.service.importSelectedVault(context, selection, importPassword);
      let message: string = this.appFormat($r('app.string.backup_imported_count'), 'Imported %1$d accounts', result.importedCount);
      this.dismissImportPasswordDialog();
      this.pendingImportSelection = undefined;
      this.showBackupStatus(message);
      this.onImported(result.vault, message);
    } catch (error) {
      let message: string = this.readErrorMessage(error, this.appString($r('app.string.error_backup_import_failed'), 'Import failed. Please try again later.'));
      if (importPassword === undefined && ImportBackupPasswordPromptPolicy.shouldPromptForPassword(message)) {
        this.showImportPasswordDialog = true;
        this.importPasswordErrorMessage = '';
        return;
      }
      if (importPassword !== undefined && ImportBackupPasswordPromptPolicy.shouldPromptForPassword(message)) {
        this.importPasswordErrorMessage = this.appString($r('app.string.error_backup_password_incorrect'), 'The backup password is incorrect. Try again.');
        return;
      }
      this.dismissImportPasswordDialog();
      this.pendingImportSelection = undefined;
      this.showBackupError(message);
    } finally {
      this.isBackupBusy = false;
    }
  }

  private dismissImportPasswordDialog(): void {
    this.showImportPasswordDialog = false;
    this.importBackupPassword = '';
    this.importPasswordErrorMessage = '';
    this.pendingImportSelection = undefined;
  }

  private showBackupStatus(message: string): void {
    this.applyBackupMessage(TransientInlineMessagePolicy.showStatus(this.currentBackupMessage(), message));
    this.scheduleBackupMessageClear(this.backupMessageVersion);
  }

  private showBackupError(message: string): void {
    this.applyBackupMessage(TransientInlineMessagePolicy.showError(this.currentBackupMessage(), message));
    this.scheduleBackupMessageClear(this.backupMessageVersion);
  }

  private scheduleBackupMessageClear(version: number): void {
    setTimeout(() => {
      this.applyBackupMessage(TransientInlineMessagePolicy.clearIfVersion(this.currentBackupMessage(), version));
    }, BACKUP_MESSAGE_VISIBLE_MS);
  }

  private currentBackupMessage(): InlineMessageState {
    return new InlineMessageState(this.backupStatusMessage, this.backupErrorMessage, this.backupMessageVersion);
  }

  private applyBackupMessage(state: InlineMessageState): void {
    this.backupStatusMessage = state.statusMessage;
    this.backupErrorMessage = state.errorMessage;
    this.backupMessageVersion = state.version;
  }

  private applySettings(settings: WebDavSettings): void {
    this.webDavEnabled = settings.enabled;
    this.serverUrl = settings.serverUrl;
    this.filePath = settings.filePath;
    this.username = settings.username;
    this.password = settings.password;
    this.syncIntervalMinutes = `${settings.syncIntervalMinutes}`;
    if (settings.updatedAt.length > 0 && this.webDavStatusMessage.length === 0 && this.webDavErrorMessage.length === 0) {
      this.webDavStatusMessage = this.appFormat($r('app.string.settings_saved_at'), 'Saved %1$s', this.formatDateLabel(settings.updatedAt));
    }
  }

  private resolveWebDavStatusMessage(): string {
    if (!this.webDavEnabled) {
      return this.appString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.');
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
      message !== this.appString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.') &&
      message !== this.appString($r('app.string.home_syncing_status'), 'Syncing...') &&
      message !== '未配置 WebDAV，数据仅保留在本机。' &&
      message !== '同步中...' &&
      message.indexOf('已关闭 WebDAV 同步') < 0;
  }

  private isRemotePasswordMessage(message: string): boolean {
    return message.indexOf('远端保管库需要主密码验证') >= 0 ||
      message.indexOf('remote vault') >= 0 ||
      message.indexOf('master password') >= 0;
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
      message.indexOf('自动合并并同步到 WebDAV') >= 0 ||
      message.indexOf('synced') >= 0 ||
      message.indexOf('Sync baseline refreshed') >= 0 ||
      message.indexOf('Master password changed and synced to WebDAV') >= 0 ||
      message.indexOf('Local and WebDAV') >= 0 ||
      message.indexOf('Local updates') >= 0 ||
      message.indexOf('Local changes') >= 0 ||
      message.indexOf('merged automatically') >= 0 ||
      message.indexOf('up to date') >= 0 ||
      message.indexOf('restored from WebDAV') >= 0 ||
      message.indexOf('updated to WebDAV') >= 0;
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

  private appString(resource: Resource, fallback: string): string {
    let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    return AppI18n.string(context, resource, fallback);
  }

  private appFormat(resource: Resource, fallback: string, ...args: Array<string | number>): string {
    let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    return AppI18n.format(context, resource, fallback, ...args);
  }
}
