@Component
export struct BottomActionDock {
  onAdd?: () => void;
  onSync?: () => void;
  onSettings?: () => void;

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Row()
        .width('74%')
        .height(22)
        .margin({ bottom: 10 })
        .backgroundColor($r('app.color.color_bottom_dock_shadow_bg'))
        .opacity(0.42)
        .borderRadius(999)

      Row()
        .width('100%')
        .height(88)
        .backgroundColor($r('app.color.color_bottom_dock_halo_bg'))
        .opacity(0.72)
        .borderRadius(999)

      Row({ space: 0 }) {
        this.buildNavAction('↻', $r('app.string.nav_sync'), false, this.onSync)
        this.buildNavAction('+', $r('app.string.nav_add'), true, this.onAdd)
        this.buildNavAction('⚙', $r('app.string.nav_settings'), false, this.onSettings)
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 10, bottom: 12 })
      .backgroundColor($r('app.color.color_bottom_dock_surface'))
      .opacity(0.94)
      .borderRadius(999)
      .border({ width: 1, color: $r('app.color.color_bottom_dock_border') })
    }
    .width('100%')
    .height(116)
  }

  @Builder
  private buildNavAction(symbol: string, label: ResourceStr, accent: boolean, action?: () => void): void {
    Column({ space: 6 }) {
      Stack({ alignContent: Alignment.Center }) {
        Row()
          .width(44)
          .height(44)
          .backgroundColor(accent ? $r('app.color.color_bottom_dock_action_bg_accent') : $r('app.color.color_bottom_dock_action_bg'))
          .opacity(accent ? 0.96 : 0.84)
          .borderRadius(22)

        Text(symbol)
          .fontSize(accent ? 24 : 22)
          .fontWeight(FontWeight.Bold)
          .fontColor(accent ? $r('app.color.color_bottom_dock_action_text_accent') : $r('app.color.color_bottom_dock_action_text'))
      }

      Text(label)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor(accent ? $r('app.color.color_bottom_dock_label_accent') : $r('app.color.color_bottom_dock_label'))
    }
    .layoutWeight(1)
    .height(72)
    .alignItems(HorizontalAlign.Center)
    .onClick(() => {
      if (action) {
        action();
      }
    })
  }
}
