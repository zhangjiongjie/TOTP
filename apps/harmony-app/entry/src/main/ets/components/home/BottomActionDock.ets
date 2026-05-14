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
        .backgroundColor('#FFFFFF')
        .opacity(0.42)
        .borderRadius(999)

      Row()
        .width('100%')
        .height(88)
        .backgroundColor('#FFF9FC')
        .opacity(0.72)
        .borderRadius(999)

      Row({ space: 0 }) {
        this.buildNavAction('↻', '同步', false, this.onSync)
        this.buildNavAction('+', '添加', true, this.onAdd)
        this.buildNavAction('⚙', '设置', false, this.onSettings)
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 10, bottom: 12 })
      .backgroundColor('#FFFDFC')
      .opacity(0.94)
      .borderRadius(999)
      .border({ width: 1, color: '#FFFFFF' })
    }
    .width('100%')
    .height(116)
  }

  @Builder
  private buildNavAction(symbol: string, label: string, accent: boolean, action?: () => void): void {
    Column({ space: 6 }) {
      Stack({ alignContent: Alignment.Center }) {
        Row()
          .width(44)
          .height(44)
          .backgroundColor(accent ? '#FDEAF2' : '#FFF8FA')
          .opacity(accent ? 0.96 : 0.84)
          .borderRadius(22)

        Text(symbol)
          .fontSize(accent ? 24 : 22)
          .fontWeight(FontWeight.Bold)
          .fontColor(accent ? '#EA6A9E' : '#735D68')
      }

      Text(label)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor(accent ? '#E7689B' : '#6E5A64')
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
