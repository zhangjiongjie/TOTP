import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import {
  HdsTabs,
  HdsTabsController,
  hdsMaterial
} from '@kit.UIDesignKit';
import { AccountCard } from '../components/home/AccountCard';
import { LocalVault } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';
import { WebDavSettings } from '../model/WebDavSettings';
import { WebDavSyncMetadata } from '../model/WebDavSyncMetadata';
import { AddAccount } from './AddAccount';
import { EditAccount } from './EditAccount';
import { Settings } from './Settings';
import { Unlock } from './Unlock';
import { UnlockService } from '../services/UnlockService';
import { SettingsService } from '../services/SettingsService';
import { TotpHomeService } from '../services/TotpHomeService';
import { TotpCodeSnapshot, TotpRuntimeService } from '../services/TotpRuntimeService';
import { WebDavSyncResult, WebDavSyncService } from '../services/WebDavSyncService';
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
  @State private syncStatusMessage: string = '未配置 WebDAV，数据仅保留在本机。';
  @State private isSyncing: boolean = false;
  @State private canSync: boolean = false;
  @State private syncSpinAngle: number = 0;
  @State private hasSyncConflict: boolean = false;
  @State private isUnlocked: boolean = false;
  @State private activeTabIndex: number = 0;
  @State private addPhotoRequestToken: number = 0;
  @State private addScanRequestToken: number = 0;
  @StorageProp('colorMode') private colorMode: ColorMode = ColorMode.LIGHT;
  private tickerId: number = -1;
  private syncAnimationId: number = -1;
  private hasSyncedOnOpen: boolean = false;
  private hasRegisteredSessionEvents: boolean = false;
  private sessionLockedHandler: () => void = () => {
    this.handleSessionLocked();
  };
  private tabsController: HdsTabsController = new HdsTabsController();
  private settingsStore: SettingsStore = new SettingsStore();

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
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (!this.isUnlocked || this.activeRoute === 'unlock') {
        Unlock({
          onUnlocked: () => {
            this.isUnlocked = true;
            this.activeRoute = 'home';
            this.copyStatusMessage = '';
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
              if (this.shouldShowStatusCard()) {
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
            onSaved: (message: string) => {
              this.syncStatusMessage = message;
              this.refreshSyncAvailability();
              if (this.canSync) {
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
    Column({ space: 12 }) {
      if (this.statusMessage.length > 0) {
        Text(this.statusMessage)
          .fontSize(14)
          .lineHeight(22)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      }

      if (this.syncStatusMessage.length > 0 && this.syncStatusMessage !== '未配置 WebDAV，数据仅保留在本机。') {
        Text(this.syncStatusMessage)
          .fontSize(13)
          .lineHeight(20)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      }

      if (this.copyStatusMessage.length > 0) {
        Text(this.copyStatusMessage)
          .fontSize(13)
          .lineHeight(20)
          .fontColor('#2D7A59')
          .width('100%')
      }

      if (this.errorMessage.length > 0) {
        Text(this.errorMessage)
          .fontSize(13)
          .lineHeight(20)
          .fontColor('#C53D3D')
          .width('100%')
      }

      if (this.hasSyncConflict) {
        this.buildSyncConflictActions()
      }
    }
    .width('100%')
    .padding(18)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(24)
  }

  @Builder
  private buildAccountSection(): void {
    Column({ space: 10 }) {
      if (this.isLoading) {
        Text('加载中...')
          .fontSize(13)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      } else if (this.accounts.length === 0) {
        this.buildEmptyState()
      } else {
        ForEach(this.accounts, (account: TotpAccount) => {
          AccountCard({
            account: account,
            codeValue: this.resolveSnapshot(account.id).codeValue,
            codeHint: this.resolveSnapshot(account.id).codeHint,
            countdownLabel: this.resolveSnapshot(account.id).countdownLabel,
            statusLabel: this.resolveSnapshot(account.id).statusLabel,
            onCopy: (accountId: string) => {
              this.handleCopy(accountId);
            },
            onEdit: (accountId: string) => {
              this.activeAccountId = accountId;
              this.activeRoute = 'edit';
            }
          })
        }, (account: TotpAccount) => account.id)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
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

  @Builder
  private buildSyncConflictActions(): void {
    Column({ space: 10 }) {
      Text('同步冲突')
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor('#8B3A1F')
        .width('100%')

      Text('本地和远端都有变化，请选择保留哪一侧。')
        .fontSize(13)
        .lineHeight(20)
        .fontColor('#6B4C3E')
        .width('100%')

      Row({ space: 10 }) {
        Button('保留本地')
          .layoutWeight(1)
          .height(42)
          .type(ButtonType.Capsule)
          .fontSize(14)
          .fontColor(Color.White)
          .backgroundColor('#1E5AA8')
          .onClick(() => {
            this.resolveSyncConflict(true);
          })

        Button('使用远端')
          .layoutWeight(1)
          .height(42)
          .type(ButtonType.Capsule)
          .fontSize(14)
          .fontColor('#2F5E95')
          .backgroundColor('#E6EEF8')
          .onClick(() => {
            this.resolveSyncConflict(false);
          })
      }
      .width('100%')
    }
    .width('100%')
    .padding(14)
    .backgroundColor('#FFF4E8')
    .borderRadius(18)
  }

  @Builder
  private buildEmptyState(): void {
    Column({ space: 10 }) {
      Text('还没有账号')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))

      Text('点击底部添加按钮录入账号。')
        .fontSize(14)
        .lineHeight(22)
        .fontColor($r('sys.color.font_secondary'))
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 28, bottom: 28 })
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(24)
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
      this.accounts = [];
      this.codeSnapshots = [];
      this.accountCountLabel = '0 个账号';
      this.lastUpdatedLabel = '最新同步：暂无';
      this.errorMessage = `读取本地保管库失败：${businessError.message}`;
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.isUnlocked = UnlockService.getInstance().readState(context).isUnlocked;
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

    if (snapshot.rawCode.length === 0) {
      this.copyStatusMessage = '当前账号验证码不可复制，请先修正密钥或算法配置。';
      return;
    }

    try {
      TotpRuntimeService.getInstance().copyCodeToClipboard(snapshot.rawCode);
      let label: string = account !== undefined && account.issuer.length > 0 ? account.issuer : '当前账号';
      this.copyStatusMessage = `已复制 ${label} 的验证码到系统剪贴板。`;
      this.statusMessage = '';
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      this.copyStatusMessage = `复制失败：${businessError.message}`;
    }
  }

  private async handleManualSync(): Promise<void> {
    if (this.isSyncing) {
      this.syncStatusMessage = '同步正在进行中，请稍后再试。';
      return;
    }

    this.refreshSyncAvailability();
    if (!this.canSync) {
      this.syncStatusMessage = '未配置 WebDAV，数据仅保留在本机。';
      return;
    }

    this.isSyncing = true;
    this.syncStatusMessage = '同步中...';
    this.startSyncAnimation();
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let result: WebDavSyncResult = await WebDavSyncService.getInstance().syncNow(context);
      if (result.vault !== undefined) {
        this.applyVault(result.vault);
      } else {
        await this.loadHome();
      }
      this.hasSyncConflict = result.status === 'conflict';
      this.syncStatusMessage = result.message;
      this.refreshLastSyncLabel(context);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      this.syncStatusMessage = businessError && businessError.message && businessError.message.length > 0
        ? `同步失败：${businessError.message}`
        : '同步失败，请稍后重试。';
    } finally {
      this.isSyncing = false;
      this.stopSyncAnimation();
    }
  }

  private shouldShowStatusCard(): boolean {
    return this.hasSyncConflict ||
      this.isSyncing ||
      this.errorMessage.length > 0 ||
      this.statusMessage.length > 0 ||
      this.copyStatusMessage.length > 0 ||
      (this.syncStatusMessage.length > 0 && this.syncStatusMessage !== '未配置 WebDAV，数据仅保留在本机。');
  }

  private syncAfterLocalChange(): void {
    this.handleManualSync();
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
    if (this.isSyncing) {
      this.syncStatusMessage = '同步正在进行中，请稍后再试。';
      return;
    }

    this.isSyncing = true;
    this.syncStatusMessage = keepLocal ? '正在用本地版本覆盖远端...' : '正在使用远端版本覆盖本地...';
    this.startSyncAnimation();
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let result: WebDavSyncResult = keepLocal
        ? await WebDavSyncService.getInstance().keepLocalVersion(context)
        : await WebDavSyncService.getInstance().useRemoteVersion(context);
      if (result.vault !== undefined) {
        this.applyVault(result.vault);
      } else {
        await this.loadHome();
      }
      this.hasSyncConflict = result.status === 'conflict';
      this.syncStatusMessage = result.message;
      this.refreshLastSyncLabel(context);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      this.syncStatusMessage = businessError && businessError.message && businessError.message.length > 0
        ? `处理冲突失败：${businessError.message}`
        : '处理冲突失败，请稍后重试。';
    } finally {
      this.isSyncing = false;
      this.stopSyncAnimation();
    }
  }

  private refreshSyncAvailability(): void {
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let settings: WebDavSettings = SettingsService.getInstance().loadWebDavSettings(context);
      this.canSync = settings.enabled && settings.serverUrl.trim().length > 0 && settings.filePath.trim().length > 0;
      if (!this.canSync && !this.isSyncing && !this.hasSyncConflict) {
        this.syncStatusMessage = '未配置 WebDAV，数据仅保留在本机。';
      }
    } catch (_error) {
      this.canSync = false;
      if (!this.isSyncing && !this.hasSyncConflict) {
        this.syncStatusMessage = '同步设置暂不可用。';
      }
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

  private resolveRootTitle(): string {
    if (this.activeTabIndex === 1) {
      return '添加账号';
    }
    if (this.activeTabIndex === 2) {
      return '设置';
    }
    return '身份验证器';
  }

  onBackPress(): boolean {
    if (this.activeRoute === 'edit') {
      this.activeRoute = 'home';
      return true;
    }
    if (this.activeTabIndex !== 0) {
      this.activeTabIndex = 0;
      this.tabsController.changeIndex(0);
      return true;
    }
    return false;
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
