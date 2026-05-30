import {
  HOME_STATUS_TONE_ERROR,
  HOME_STATUS_TONE_SUCCESS,
  HomeStatusPresentation
} from '../../policies/HomeStatusPresentationPolicy';

@Component
export struct HomeStatusCard {
  presentation: HomeStatusPresentation = new HomeStatusPresentation(false, '', HOME_STATUS_TONE_SUCCESS);
  hasSyncConflict: boolean = false;
  isDarkMode: boolean = false;
  onKeepLocal: () => void = () => {};
  onUseRemote: () => void = () => {};

  build() {
    Column({ space: 12 }) {
      Text(this.presentation.message)
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
            this.onKeepLocal();
          })

        Button('使用远端')
          .layoutWeight(1)
          .height(42)
          .type(ButtonType.Capsule)
          .fontSize(14)
          .fontColor('#2F5E95')
          .backgroundColor('#E6EEF8')
          .onClick(() => {
            this.onUseRemote();
          })
      }
      .width('100%')
    }
    .width('100%')
    .padding(14)
    .backgroundColor('#FFF4E8')
    .borderRadius(18)
  }

  private resolveBannerColor(): ResourceColor {
    if (this.presentation.tone === HOME_STATUS_TONE_ERROR) {
      return this.isDarkMode ? '#FF6B6B' : '#C53D3D';
    }
    if (this.presentation.tone === HOME_STATUS_TONE_SUCCESS) {
      return this.isDarkMode ? '#58C18F' : '#2D7A59';
    }
    return $r('sys.color.font_secondary');
  }
}
