import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import {
  HdsTabs,
  HdsTabsController,
  hdsMaterial
} from '@kit.UIDesignKit';
import { HomeAccountSection } from '../components/home/HomeAccountSection';
import { HomeStatusCard } from '../components/home/HomeStatusCard';
import { RemotePasswordDialog } from '../components/home/RemotePasswordDialog';
import { LocalVault } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';
import { WebDavSettings } from '../model/WebDavSettings';
import { WebDavSyncMetadata } from '../model/WebDavSyncMetadata';
import { AddAccount } from './AddAccount';
import { EditAccount } from './EditAccount';
import { Settings } from './Settings';
import { Unlock } from './Unlock';
import { UnlockService } from '../services/UnlockService';
import {
  HomeRegularSyncStatusInput,
  HomeStatusPresentation,
  HomeStatusPresentationInput,
  HomeStatusPresentationPolicy
} from '../policies/HomeStatusPresentationPolicy';
import {
  HOME_SYNC_OPERATION_CONFLICT_KEEP_LOCAL,
  HOME_SYNC_OPERATION_CONFLICT_USE_REMOTE,
  HOME_SYNC_OPERATION_LOCAL_CHANGE,
  HOME_SYNC_OPERATION_MANUAL,
  HomeSyncAvailabilityResult,
  HomeSyncOperationStartResult,
  HomeSyncUiStatePolicy
} from '../policies/HomeSyncUiStatePolicy';
import {
  ACCOUNT_COPY_KIND_ERROR,
  AccountCopyPresentation,
  AccountCopyPresentationPolicy
} from '../policies/AccountCopyPresentationPolicy';
import { HomeBackAction, HomeRoutePolicy } from '../policies/HomeRoutePolicy';
import { SettingsService } from '../services/SettingsService';
import {
  HOME_MESSAGE_KIND_ERROR,
  REMOTE_PASSWORD_DIALOG_HIDE,
  REMOTE_PASSWORD_DIALOG_SHOW,
  SyncResultPresentation
} from '../policies/SyncResultPresentationPolicy';
import { TotpHomeService } from '../services/TotpHomeService';
import { TotpCodeSnapshot, TotpRuntimeService } from '../services/TotpRuntimeService';
import { WebDavSyncActionOutcome, WebDavSyncCoordinator } from '../services/WebDavSyncCoordinator';
import { SettingsStore } from '../storage/SettingsStore';

const VAULT_SESSION_LOCKED_EVENT: string = 'totpVaultSessionLocked';

@Entry
@Component
struct Index {
  @State private isLoading: boolean = true;
  @State private accounts: TotpAccount[] = [];
  @State private codeSnapshots: TotpCodeSnapshot[] = [];
  @State private accountCountLabel: string = '0 个账号';
  @State private lastUpdatedLabel: string = '最新同步：暂无';
  @State private statusMessage: string = '';
  @State private copyStatusMessage: string = '';
  @State private errorMessage: string = '';
  @State private activeRoute: string = 'home';
  @State private activeAccountId: string = '';
  @State private syncStatusMessage: string = 'WebDAV 同步未开启，本地模式。';
  @State private isSyncing: boolean = false;
  @State private canSync: boolean = false;
  @State private syncSpinAngle: number = 0;
  @State private hasSyncConflict: boolean = false;
  @State private showRemotePasswordDialog: boolean = false;
  @State private remotePassword: string = '';
  @State private remotePasswordError: string = '';
  @State private isRemotePasswordBusy: boolean = false;
  @State private isUnlocked: boolean = false;
  @State private activeTabIndex: number = 0;
  @State private addPhotoRequestToken: number = 0;
  @State private addScanRequestToken: number = 0;
  @StorageProp('colorMode') private colorMode: ColorMode = ColorMode.LIGHT;
  private tickerId: number = -1;
  private syncAnimationId: number = -1;
  private transientStatusTimerId: number = -1;
  private hasSyncedOnOpen: boolean = false;
  private hasRegisteredSessionEvents: boolean = false;
  private sessionLockedHandler: () => void = () => {
    this.handleSessionLocked();
  };
  private tabsController: HdsTabsController = new HdsTabsController();
  private settingsStore: SettingsStore = new SettingsStore();
  private syncCoordinator: WebDavSyncCoordinator = new WebDavSyncCoordinator();

  aboutToAppear(): void {
    Environment.envProp('colorMode', ColorMode.LIGHT);
    this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    this.registerSessionEvents();
    this.startTicker();
    this.loadHome().then(() => {
      this.syncOnOpenOnce();
    });
  }

  onPageShow(): void {
    this.refreshUnlockSessionState();
  }

  aboutToDisappear(): void {
    this.stopTicker();
    this.stopSyncAnimation();
    this.clearTransientStatusTimer();
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (!this.isUnlocked || this.activeRoute === 'unlock') {
        Unlock({
          onUnlocked: () => {
            this.isUnlocked = true;
            this.activeRoute = 'home';
            this.copyStatusMessage = '';
            this.errorMessage = '';
            this.loadHome();
            this.hasSyncedOnOpen = false;
            setTimeout(() => {
              this.syncOnOpenOnce();
            }, 200);
          }
        })
      } else if (this.activeRoute === 'add') {
        this.buildHomePage()
      } else if (this.activeRoute === 'edit') {
        this.buildEditPage()
      } else {
        this.buildHomePage()
      }
      if (this.isUnlocked && this.activeRoute !== 'unlock' && this.showRemotePasswordDialog) {
        this.buildRemotePasswordDialog()
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('sys.color.ohos_id_color_background'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }

  @Builder
  private buildHomePage(): void {
    Column() {
      this.buildFixedHeader()
      this.buildTabsContent()
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  private buildTabsContent(): void {
    Stack({ alignContent: Alignment.BottomEnd }) {
      HdsTabs({ controller: this.tabsController }) {
        TabContent() {
          Scroll() {
            Column({ space: 14 }) {
              this.buildHomeMetaLine()
              if (this.resolveHomeStatusPresentation().shouldShow) {
                this.buildStatusCard()
              }
              this.buildAccountSection()
              Blank()
                .height(140)
            }
            .width('100%')
            .padding({ left: 16, right: 16, top: 6, bottom: 24 })
          }
          .width('100%')
          .scrollBar(BarState.Auto)
        }
        .tabBar(BottomTabBarStyle.of($r('app.media.nav_home'), '首页')
          .iconStyle({ selectedColor: this.resolveTabSelectedColor(), unselectedColor: this.resolveTabUnselectedColor() })
          .labelStyle({ selectedColor: this.resolveTabSelectedColor(), unselectedColor: this.resolveTabUnselectedColor() }))

        TabContent() {
          AddAccount({
            showBackButton: false,
            bottomInset: 116,
            topInset: 0,
            photoRequestToken: this.addPhotoRequestToken,
            scanRequestToken: this.addScanRequestToken,
            onSaved: (vault: LocalVault) => {
              this.applyVault(vault);
              this.syncStatusMessage = '同步中...';
              this.syncAfterLocalChange();
              this.activeTabIndex = 0;
              this.tabsController.changeIndex(0);
            },
            onBack: () => {
              this.activeTabIndex = 0;
              this.tabsController.changeIndex(0);
            }
          })
        }
        .tabBar(BottomTabBarStyle.of($r('app.media.nav_add'), '添加')
          .iconStyle({ selectedColor: this.resolveTabSelectedColor(), unselectedColor: this.resolveTabUnselectedColor() })
          .labelStyle({ selectedColor: this.resolveTabSelectedColor(), unselectedColor: this.resolveTabUnselectedColor() }))

        TabContent() {
          Settings({
            syncStatusMessage: this.syncStatusMessage,
            copyStatusMessage: this.copyStatusMessage,
            lastUpdatedLabel: this.lastUpdatedLabel,
            bottomInset: 116,
            topInset: 0,
            onSaved: (message: string, vault: LocalVault | undefined, alreadySynced: boolean) => {
              if (vault !== undefined) {
                this.applyVault(vault);
              }
              this.syncStatusMessage = message;
              this.refreshSyncAvailability();
              if (message === 'WebDAV 同步未开启，本地模式。') {
                this.canSync = false;
                this.hasSyncConflict = false;
                this.showRemotePasswordDialog = false;
                this.clearTransientStatusTimer();
                this.copyStatusMessage = '';
                this.errorMessage = '';
                return;
              }
              if (this.canSync && !alreadySynced) {
                this.handleManualSync();
              }
            },
            onImported: (vault: LocalVault, message: string) => {
              this.applyVault(vault);
              this.syncStatusMessage = message;
              this.refreshSyncAvailability();
              if (this.canSync) {
                this.syncAfterLocalChange();
              }
            },
            onPasswordChanged: (vault: LocalVault, message: string) => {
              this.applyVault(vault);
              this.syncStatusMessage = message;
              this.refreshSyncAvailability();
            }
          })
        }
        .tabBar(BottomTabBarStyle.of($r('app.media.nav_settings'), '设置')
          .iconStyle({ selectedColor: this.resolveTabSelectedColor(), unselectedColor: this.resolveTabUnselectedColor() })
          .labelStyle({ selectedColor: this.resolveTabSelectedColor(), unselectedColor: this.resolveTabUnselectedColor() }))
      }
      .barOverlap(true)
      .barPosition(BarPosition.End)
      .vertical(false)
      .animationDuration(0)
      .barFloatingStyle({
        barWidth: {
          smallWidth: 304,
          mediumWidth: 404,
          largeWidth: 504
        },
        barBottomMargin: 18,
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.IMMERSIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
        }
      })
      .width('100%')
      .height('100%')
      .onChange((index: number) => {
        this.activeTabIndex = index;
      })

    }
    .width('100%')
    .layoutWeight(1)
  }

  @Builder
  private buildFixedHeader(): void {
    Row() {
      Text(this.resolveRootTitle())
        .fontSize(25)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (this.activeTabIndex === 1) {
        Row({ space: 12 }) {
          this.buildHeaderIconButton($r('app.media.action_photo'), () => {
            this.addPhotoRequestToken++;
          })
          this.buildHeaderIconButton($r('app.media.action_scan'), () => {
            this.addScanRequestToken++;
          })
        }
      } else if (this.activeTabIndex === 0) {
        this.buildHeaderSyncButton()
      }
    }
    .width('100%')
    .height(this.resolveHeaderHeight())
    .alignItems(VerticalAlign.Top)
    .padding({ left: 20, right: 20, top: 14 })
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  @Builder
  private buildHeaderIconButton(icon: Resource, action: () => void): void {
    Button() {
      Image(icon)
        .width(22)
        .height(22)
        .objectFit(ImageFit.Contain)
    }
    .width(40)
    .height(40)
    .type(ButtonType.Circle)
    .backgroundColor(this.isDarkMode() ? '#1C1C1E' : '#EEF3F8')
    .border({ width: 1, color: this.isDarkMode() ? '#2F333A' : '#D5DFEA' })
    .onClick(() => {
      action();
    })
  }

  @Builder
  private buildHeaderSyncButton(): void {
    Button() {
      Image($r('app.media.nav_sync'))
        .width(22)
        .height(22)
        .objectFit(ImageFit.Contain)
        .rotate({ angle: this.syncSpinAngle })
        .opacity(this.canSync ? 1 : 0.42)
    }
    .width(40)
    .height(40)
    .type(ButtonType.Circle)
    .backgroundColor(this.isDarkMode() ? '#1C1C1E' : '#EEF3F8')
    .border({ width: 1, color: this.isDarkMode() ? '#2F333A' : '#D5DFEA' })
    .onClick(() => {
      this.handleManualSync();
    })
  }

  @Builder
  private buildHomeMetaLine(): void {
    Text(this.resolveHomeSubTitle())
      .fontSize(14)
      .fontColor($r('sys.color.font_secondary'))
      .width('100%')
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
  }

  @Builder
  private buildEditPage(): void {
    if (this.hasActiveAccount()) {
      Column() {
        this.buildEditFixedHeader()
        EditAccount({
          account: this.requireActiveAccount(),
          topInset: 0,
          bottomInset: 116,
          onSaved: (vault: LocalVault) => {
            this.applyVault(vault);
            this.activeRoute = 'home';
            this.syncStatusMessage = '同步中...';
            this.syncAfterLocalChange();
          },
          onDeleted: (vault: LocalVault) => {
            this.applyVault(vault);
            this.activeRoute = 'home';
            this.syncStatusMessage = '同步中...';
            this.syncAfterLocalChange();
          },
          onBack: () => {
            this.activeRoute = 'home';
          }
        })
      }
      .width('100%')
      .height('100%')
    } else {
      this.buildHomePage()
    }
  }

  @Builder
  private buildEditFixedHeader(): void {
    Row({ space: 10 }) {
      this.buildHeaderBackButton()

      Text('编辑账号')
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
    .padding({ left: 12, right: 20, top: 14 })
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  @Builder
  private buildHeaderBackButton(): void {
    Button() {
      Image($r('app.media.action_back'))
        .width(24)
        .height(24)
        .objectFit(ImageFit.Contain)
    }
    .width(44)
    .height(44)
    .type(ButtonType.Circle)
    .backgroundColor(Color.Transparent)
    .onClick(() => {
      this.activeRoute = 'home';
    })
  }

  @Builder
  private buildStatusCard(): void {
    HomeStatusCard({
      presentation: this.resolveHomeStatusPresentation(),
      hasSyncConflict: this.hasSyncConflict,
      isDarkMode: this.isDarkMode(),
      onKeepLocal: () => {
        this.resolveSyncConflict(true);
      },
      onUseRemote: () => {
        this.resolveSyncConflict(false);
      }
    })
  }

  @Builder
  private buildAccountSection(): void {
    HomeAccountSection({
      isLoading: this.isLoading,
      accounts: this.accounts,
      snapshots: this.codeSnapshots,
      onCopy: (accountId: string) => {
        this.handleCopy(accountId);
      },
      onEdit: (accountId: string) => {
        this.activeAccountId = accountId;
        this.activeRoute = 'edit';
      }
    })
  }

  @Builder
  private buildSyncFab(): void {
    Column({ space: 4 }) {
      Image($r('app.media.nav_sync'))
        .width(28)
        .height(28)
        .rotate({ angle: this.syncSpinAngle })
        .opacity(this.canSync ? 1 : 0.42)

      Text(this.isSyncing ? '同步中' : (this.canSync ? '同步' : '未配置'))
        .fontSize(12)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.canSync ? '#1F6BAE' : '#8A96A8')
    }
    .width(72)
    .height(72)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(this.canSync ? (this.isSyncing ? '#DDEBFA' : '#EAF3FF') : '#EEF1F5')
    .borderRadius(36)
    .shadow({ radius: 14, color: this.canSync ? '#241F6BAE' : '#1A667085', offsetX: 0, offsetY: 6 })
    .margin({ right: 22, bottom: 112 })
    .opacity(this.canSync ? 1 : 0.78)
    .onClick(() => {
      this.handleManualSync();
    })
  }

  private async loadHome(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.refreshSyncAvailability();
      this.refreshLastSyncLabel(context);
      this.isUnlocked = UnlockService.getInstance().readState(context).isUnlocked;
      if (!this.isUnlocked) {
        this.accounts = [];
        this.codeSnapshots = [];
        this.accountCountLabel = '0 个账号';
        this.lastUpdatedLabel = '最新同步：暂无';
        this.statusMessage = '';
        return;
      }

      let service: TotpHomeService = TotpHomeService.getInstance();
      let vault: LocalVault = service.ensureVault(context);
      this.applyVault(vault);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      this.showHomeError(`读取本地保管库失败：${businessError.message}`);
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.isUnlocked = UnlockService.getInstance().readState(context).isUnlocked;
      if (this.accounts.length === 0) {
        this.codeSnapshots = [];
        this.accountCountLabel = '0 个账号';
        this.lastUpdatedLabel = '最新同步：暂无';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private registerSessionEvents(): void {
    if (this.hasRegisteredSessionEvents) {
      return;
    }

    let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    context.eventHub.on(VAULT_SESSION_LOCKED_EVENT, this.sessionLockedHandler);
    this.hasRegisteredSessionEvents = true;
  }

  private refreshUnlockSessionState(): void {
    let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    if (!UnlockService.getInstance().readState(context).isUnlocked) {
      this.handleSessionLocked();
    }
  }

  private handleSessionLocked(): void {
    this.isUnlocked = false;
    this.activeRoute = 'unlock';
    this.activeAccountId = '';
    this.activeTabIndex = 0;
    this.accounts = [];
    this.codeSnapshots = [];
    this.accountCountLabel = '0 个账号';
    this.copyStatusMessage = '';
    this.statusMessage = '';
    this.errorMessage = '';
    this.hasSyncConflict = false;
    this.showRemotePasswordDialog = false;
    this.remotePassword = '';
    this.remotePasswordError = '';
    this.isRemotePasswordBusy = false;
    this.hasSyncedOnOpen = false;
    this.isSyncing = false;
    this.stopSyncAnimation();
    this.tabsController.changeIndex(0);
  }

  private applyVault(vault: LocalVault): void {
    this.accounts = vault.accounts;
    this.refreshSnapshots();
    this.accountCountLabel = `${vault.accounts.length} 个账号`;
    let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.refreshLastSyncLabel(context);
  }

  private findAccount(accountId: string): TotpAccount | undefined {
    for (let index: number = 0; index < this.accounts.length; index++) {
      if (this.accounts[index].id === accountId) {
        return this.accounts[index];
      }
    }
    return undefined;
  }

  private hasActiveAccount(): boolean {
    return this.findAccount(this.activeAccountId) !== undefined;
  }

  private requireActiveAccount(): TotpAccount {
    let account: TotpAccount | undefined = this.findAccount(this.activeAccountId);
    if (account === undefined) {
      return new TotpAccount('', '', '', '', 6, 30, 'SHA1', 'Default', '', '');
    }
    return account;
  }

  private resolveSnapshot(accountId: string): TotpCodeSnapshot {
    for (let index: number = 0; index < this.codeSnapshots.length; index++) {
      if (this.codeSnapshots[index].accountId === accountId) {
        return this.codeSnapshots[index];
      }
    }
    return new TotpCodeSnapshot(accountId, '', '------', '等待生成验证码', '30s / 30s', '本地保管库');
  }

  private refreshSnapshots(): void {
    this.codeSnapshots = TotpRuntimeService.getInstance().createSnapshots(this.accounts, Date.now());
  }

  private startTicker(): void {
    if (this.tickerId >= 0) {
      return;
    }

    this.tickerId = setInterval(() => {
      this.refreshSnapshots();
    }, 1000);
  }

  private stopTicker(): void {
    if (this.tickerId >= 0) {
      clearInterval(this.tickerId);
      this.tickerId = -1;
    }
  }

  private startSyncAnimation(): void {
    if (this.syncAnimationId >= 0) {
      return;
    }

    this.syncAnimationId = setInterval(() => {
      this.syncSpinAngle = (this.syncSpinAngle + 30) % 360;
    }, 90);
  }

  private stopSyncAnimation(): void {
    if (this.syncAnimationId >= 0) {
      clearInterval(this.syncAnimationId);
      this.syncAnimationId = -1;
    }
    this.syncSpinAngle = 0;
  }

  private handleCopy(accountId: string): void {
    let snapshot: TotpCodeSnapshot = this.resolveSnapshot(accountId);
    let account: TotpAccount | undefined = this.findAccount(accountId);
    let presentation: AccountCopyPresentation = AccountCopyPresentationPolicy.resolve(snapshot, account);

    if (presentation.kind === ACCOUNT_COPY_KIND_ERROR) {
      this.showHomeError(presentation.message);
      return;
    }

    try {
      TotpRuntimeService.getInstance().copyCodeToClipboard(snapshot.rawCode);
      this.showHomeSuccess(presentation.message);
      this.statusMessage = '';
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      this.showHomeError(`复制失败：${businessError.message}`);
    }
  }

  private async handleManualSync(): Promise<void> {
    this.refreshSyncAvailability();
    let startResult: HomeSyncOperationStartResult = HomeSyncUiStatePolicy.resolveOperationStart(
      HOME_SYNC_OPERATION_MANUAL,
      this.isSyncing,
      this.canSync
    );
    if (!this.startSyncOperation(startResult)) {
      return;
    }
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let outcome: WebDavSyncActionOutcome = await this.syncCoordinator.manualSync(context, this.isUnlocked, this.activeRoute);
      this.applySyncActionOutcome(outcome);
      if (!outcome.hasError()) {
        this.refreshLastSyncLabel(context);
      }
    } finally {
      this.isSyncing = false;
      this.stopSyncAnimation();
    }
  }

  @Builder
  private buildRemotePasswordDialog(): void {
    RemotePasswordDialog({
      password: this.remotePassword,
      errorMessage: this.remotePasswordError,
      isBusy: this.isRemotePasswordBusy,
      onPasswordChange: (value: string) => {
        this.remotePassword = value;
      },
      onVerify: () => {
        this.verifyRemotePassword();
      },
      onCancel: () => {
        this.showRemotePasswordDialog = false;
        this.remotePassword = '';
        this.remotePasswordError = '';
      }
    })
  }

  private async verifyRemotePassword(): Promise<void> {
    if (this.remotePassword.trim().length === 0) {
      this.remotePasswordError = '请输入远端主密码。';
      return;
    }
    this.isRemotePasswordBusy = true;
    this.remotePasswordError = '';
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let outcome: WebDavSyncActionOutcome = await this.syncCoordinator.verifyRemotePassword(context, this.remotePassword);
      this.applySyncActionOutcome(outcome);
      if (outcome.remotePasswordVerified) {
        this.refreshLastSyncLabel(context);
        this.showRemotePasswordDialog = false;
        this.remotePassword = '';
        this.remotePasswordError = '';
        this.hasSyncedOnOpen = true;
      }
    } finally {
      this.isRemotePasswordBusy = false;
    }
  }

  private syncAfterLocalChange(): void {
    this.handleLocalChangeSync();
  }

  private async handleLocalChangeSync(): Promise<void> {
    this.refreshSyncAvailability();
    let startResult: HomeSyncOperationStartResult = HomeSyncUiStatePolicy.resolveOperationStart(
      HOME_SYNC_OPERATION_LOCAL_CHANGE,
      this.isSyncing,
      this.canSync
    );
    if (!this.startSyncOperation(startResult)) {
      return;
    }
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let outcome: WebDavSyncActionOutcome = await this.syncCoordinator.syncLocalChange(context, this.isUnlocked, this.activeRoute);
      this.applySyncActionOutcome(outcome);
      if (!outcome.hasError()) {
        this.refreshLastSyncLabel(context);
      }
    } finally {
      this.isSyncing = false;
      this.stopSyncAnimation();
    }
  }

  private syncOnOpenOnce(): void {
    if (this.hasSyncedOnOpen) {
      return;
    }
    this.hasSyncedOnOpen = true;
    this.refreshSyncAvailability();
    if (this.canSync && !this.isSyncing) {
      this.handleManualSync();
    }
  }

  private async resolveSyncConflict(keepLocal: boolean): Promise<void> {
    let operation: string = keepLocal ? HOME_SYNC_OPERATION_CONFLICT_KEEP_LOCAL : HOME_SYNC_OPERATION_CONFLICT_USE_REMOTE;
    let startResult: HomeSyncOperationStartResult = HomeSyncUiStatePolicy.resolveOperationStart(operation, this.isSyncing, true);
    if (!this.startSyncOperation(startResult)) {
      return;
    }
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let outcome: WebDavSyncActionOutcome = await this.syncCoordinator.resolveConflict(context, keepLocal);
      this.applySyncActionOutcome(outcome);
      if (!outcome.hasError()) {
        this.refreshLastSyncLabel(context);
      }
    } finally {
      this.isSyncing = false;
      this.stopSyncAnimation();
    }
  }

  private refreshSyncAvailability(): void {
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let settings: WebDavSettings = SettingsService.getInstance().loadWebDavSettings(context);
      this.applySyncAvailability(settings.enabled && settings.serverUrl.trim().length > 0 && settings.filePath.trim().length > 0, false);
    } catch (_error) {
      this.applySyncAvailability(false, true);
    }
  }

  private startSyncOperation(startResult: HomeSyncOperationStartResult): boolean {
    if (!startResult.canStart) {
      if (startResult.errorMessage.length > 0) {
        this.showHomeError(startResult.errorMessage);
      }
      if (startResult.successMessage.length > 0) {
        this.showHomeSuccess(startResult.successMessage);
      }
      if (startResult.syncStatusMessage.length > 0) {
        this.syncStatusMessage = startResult.syncStatusMessage;
      }
      return false;
    }

    this.isSyncing = true;
    this.syncStatusMessage = startResult.syncStatusMessage;
    this.startSyncAnimation();
    return true;
  }

  private applySyncAvailability(canSync: boolean, hasSettingsError: boolean): void {
    let availability: HomeSyncAvailabilityResult = HomeSyncUiStatePolicy.resolveAvailability(
      canSync,
      this.isSyncing,
      this.hasSyncConflict,
      hasSettingsError
    );
    this.canSync = availability.canSync;
    if (availability.syncStatusMessage.length > 0) {
      this.syncStatusMessage = availability.syncStatusMessage;
    }
  }

  private refreshLastSyncLabel(context: common.UIAbilityContext): void {
    try {
      let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
      this.lastUpdatedLabel = metadata.lastSyncedAt.length > 0
        ? `最新同步：${this.formatDateLabel(metadata.lastSyncedAt)}`
        : '最新同步：暂无';
    } catch (_error) {
      this.lastUpdatedLabel = '最新同步：暂无';
    }
  }

  private resolveHomeSubTitle(): string {
    return `${this.accountCountLabel} · ${this.lastUpdatedLabel}`;
  }

  private resolveHomeStatusPresentation(): HomeStatusPresentation {
    return HomeStatusPresentationPolicy.resolve(new HomeStatusPresentationInput(
      this.hasSyncConflict,
      this.isSyncing,
      this.errorMessage,
      this.statusMessage,
      this.copyStatusMessage,
      this.resolveRegularHomeSyncStatus()
    ));
  }

  private resolveRegularHomeSyncStatus(): string {
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let settings: WebDavSettings = SettingsService.getInstance().loadWebDavSettings(context);
      let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
      return HomeStatusPresentationPolicy.resolveRegularSyncStatus(new HomeRegularSyncStatusInput(
        this.isSyncing,
        settings.enabled && settings.serverUrl.trim().length > 0 && settings.filePath.trim().length > 0,
        metadata.lastStatus === 'blocked',
        false,
        metadata.lastError
      ));
    } catch (_error) {
      return HomeStatusPresentationPolicy.resolveRegularSyncStatus(new HomeRegularSyncStatusInput(
        this.isSyncing,
        false,
        false,
        true,
        ''
      ));
    }
  }

  private showHomeSuccess(message: string): void {
    this.copyStatusMessage = message;
    this.errorMessage = '';
    this.scheduleClearTransientHomeStatus();
  }

  private showHomeError(message: string): void {
    this.errorMessage = message;
    this.copyStatusMessage = '';
    this.scheduleClearTransientHomeStatus();
  }

  private applySyncResultPresentation(presentation: SyncResultPresentation): void {
    this.hasSyncConflict = presentation.hasSyncConflict;
    this.syncStatusMessage = presentation.syncStatusMessage;
    if (presentation.remotePasswordDialogAction === REMOTE_PASSWORD_DIALOG_SHOW) {
      this.showRemotePasswordDialog = true;
    } else if (presentation.remotePasswordDialogAction === REMOTE_PASSWORD_DIALOG_HIDE) {
      this.showRemotePasswordDialog = false;
    }
    if (presentation.homeMessageKind === HOME_MESSAGE_KIND_ERROR) {
      this.showHomeError(presentation.homeMessage);
      return;
    }
    this.showHomeSuccess(presentation.homeMessage);
  }

  private applySyncActionOutcome(outcome: WebDavSyncActionOutcome): void {
    if (outcome.vault !== undefined) {
      this.applyVault(outcome.vault);
    }
    if (outcome.presentation !== undefined) {
      this.applySyncResultPresentation(outcome.presentation);
    }
    if (outcome.errorMessage.length > 0) {
      this.syncStatusMessage = outcome.errorMessage;
      this.showHomeError(outcome.errorMessage);
    }
    if (outcome.remotePasswordErrorMessage.length > 0) {
      this.remotePasswordError = outcome.remotePasswordErrorMessage;
    }
  }

  private scheduleClearTransientHomeStatus(): void {
    this.clearTransientStatusTimer();
    this.transientStatusTimerId = setTimeout(() => {
      this.copyStatusMessage = '';
      this.errorMessage = '';
      this.transientStatusTimerId = -1;
    }, 2000);
  }

  private clearTransientStatusTimer(): void {
    if (this.transientStatusTimerId >= 0) {
      clearTimeout(this.transientStatusTimerId);
      this.transientStatusTimerId = -1;
    }
  }

  private resolveRootTitle(): ResourceStr {
    if (this.activeTabIndex === 1) {
      return '添加账号';
    }
    if (this.activeTabIndex === 2) {
      return '设置';
    }
    return $r('app.string.EntryAbility_label');
  }

  onBackPress(): boolean {
    let action: HomeBackAction = HomeRoutePolicy.resolveBackAction(this.activeRoute, this.activeTabIndex);
    if (!action.shouldHandle) {
      return false;
    }
    this.activeRoute = action.nextRoute;
    if (this.activeTabIndex !== action.nextTabIndex) {
      this.tabsController.changeIndex(action.nextTabIndex);
    }
    this.activeTabIndex = action.nextTabIndex;
    return true;
  }

  private resolveHeaderHeight(): number {
    return 76;
  }

  private isDarkMode(): boolean {
    return this.colorMode === ColorMode.DARK;
  }

  private resolveTabSelectedColor(): string {
    return this.isDarkMode() ? '#62B7FF' : '#1F6BAE';
  }

  private resolveTabUnselectedColor(): string {
    return this.isDarkMode() ? '#F2F6FF' : '#667085';
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
