@Component
export struct HomeFixedHeader {
  @Prop title: ResourceStr = '';
  @Prop activeTabIndex: number = 0;
  @Prop heightValue: number = 76;
  @Prop isDarkMode: boolean = false;
  @Prop canSync: boolean = false;
  @Prop syncSpinAngle: number = 0;
  onPhoto?: () => void;
  onScan?: () => void;
  onSync?: () => void;

  build() {
    Row() {
      Text(this.title)
        .fontSize(25)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (this.activeTabIndex === 1) {
        Row({ space: 12 }) {
          this.buildIconButton($r('app.media.action_photo'), () => {
            if (this.onPhoto) {
              this.onPhoto();
            }
          })
          this.buildIconButton($r('app.media.action_scan'), () => {
            if (this.onScan) {
              this.onScan();
            }
          })
        }
      } else if (this.activeTabIndex === 0) {
        this.buildSyncButton()
      }
    }
    .width('100%')
    .height(this.heightValue)
    .alignItems(VerticalAlign.Top)
    .padding({ left: 20, right: 20, top: 14 })
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  @Builder
  private buildIconButton(icon: Resource, action: () => void): void {
    Button() {
      Image(icon)
        .width(22)
        .height(22)
        .objectFit(ImageFit.Contain)
    }
    .width(40)
    .height(40)
    .type(ButtonType.Circle)
    .backgroundColor($r('app.color.color_header_icon_bg'))
    .border({ width: 1, color: $r('app.color.color_header_icon_border') })
    .onClick(() => {
      action();
    })
  }

  @Builder
  private buildSyncButton(): void {
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
    .backgroundColor($r('app.color.color_header_icon_bg'))
    .border({ width: 1, color: $r('app.color.color_header_icon_border') })
    .onClick(() => {
      if (this.onSync) {
        this.onSync();
      }
    })
  }
}
