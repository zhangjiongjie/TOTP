@Component
export struct EditFixedHeader {
  @Prop heightValue: number = 76;
  onBack?: () => void;

  build() {
    Row({ space: 10 }) {
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
        if (this.onBack) {
          this.onBack();
        }
      })

      Text('编辑账号')
        .fontSize(25)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(this.heightValue)
    .alignItems(VerticalAlign.Top)
    .padding({ left: 12, right: 20, top: 14 })
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }
}
