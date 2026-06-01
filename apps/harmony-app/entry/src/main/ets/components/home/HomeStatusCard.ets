import {
  HOME_STATUS_TONE_ERROR,
  HOME_STATUS_TONE_SUCCESS,
  HOME_STATUS_TONE_SECONDARY
} from '../../policies/HomeStatusPresentationPolicy';

@Component
export struct HomeStatusCard {
  @Prop message: string = '';
  @Prop tone: string = HOME_STATUS_TONE_SECONDARY;
  @Prop hasSyncConflict: boolean = false;
  @Prop isDarkMode: boolean = false;
  onKeepLocal: () => void = () => {};
  onUseRemote: () => void = () => {};

  build() {
    Column({ space: 12 }) {
      Text(this.message)
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.resolveBannerColor())
        .width('100%')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

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
  private buildSyncConflictActions(): void {
    Column({ space: 10 }) {
      Text($r('app.string.home_sync_conflict_title'))
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.color_warning_title'))
        .width('100%')

      Text($r('app.string.home_sync_conflict_body'))
        .fontSize(13)
        .lineHeight(20)
        .fontColor($r('app.color.color_warning_text'))
        .width('100%')

      Row({ space: 10 }) {
        Button($r('app.string.home_sync_conflict_keep_local'))
          .layoutWeight(1)
          .height(42)
          .type(ButtonType.Capsule)
          .fontSize(14)
          .fontColor($r('sys.color.ohos_id_color_foreground_contrary'))
          .backgroundColor($r('app.color.color_primary'))
          .onClick(() => {
            this.onKeepLocal();
          })

        Button($r('app.string.home_sync_conflict_use_remote'))
          .layoutWeight(1)
          .height(42)
          .type(ButtonType.Capsule)
          .fontSize(14)
          .fontColor($r('app.color.color_conflict_secondary_text'))
          .backgroundColor($r('app.color.color_conflict_secondary_bg'))
          .onClick(() => {
            this.onUseRemote();
          })
      }
      .width('100%')
    }
    .width('100%')
    .padding(14)
    .backgroundColor($r('app.color.color_warning_soft'))
    .borderRadius(18)
  }

  private resolveBannerColor(): ResourceColor {
    if (this.tone === HOME_STATUS_TONE_ERROR) {
      return $r('app.color.color_danger');
    }
    if (this.tone === HOME_STATUS_TONE_SUCCESS) {
      return $r('app.color.color_success');
    }
    return $r('sys.color.font_secondary');
  }
}
