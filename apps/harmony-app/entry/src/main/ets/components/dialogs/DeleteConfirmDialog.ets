@Component
export struct DeleteConfirmDialog {
  title: string = '确认删除';
  content: string = '删除后将从本地保管库移除该账号。';
  confirmText: string = '删除';
  cancelText: string = '取消';
  onConfirm: () => void = () => {};
  onCancel: () => void = () => {};

  build() {
    Stack() {
      Column()
        .width('100%')
        .height('100%')
        .onClick(() => {
          this.onCancel();
        })

      Column({ space: 16 }) {
        Text(this.title)
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('sys.color.font_primary'))

        Text(this.content)
          .fontSize(14)
          .lineHeight(22)
          .fontColor($r('sys.color.font_secondary'))
          .textAlign(TextAlign.Center)
          .width('100%')

        Row({ space: 12 }) {
          Button(this.cancelText)
            .layoutWeight(1)
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(15)
            .fontColor($r('sys.color.font_primary'))
            .backgroundColor($r('sys.color.comp_background_gray'))
            .onClick(() => {
              this.onCancel();
            })

          Button(this.confirmText)
            .layoutWeight(1)
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(15)
            .fontColor(Color.White)
            .backgroundColor('#D84B4B')
            .onClick(() => {
              this.onConfirm();
            })
        }
        .width('100%')
      }
      .width('86%')
      .padding(22)
      .backgroundColor($r('app.color.dialog_surface'))
      .border({ width: 1, color: $r('app.color.dialog_border') })
      .borderRadius(26)
      .shadow({ radius: 28, color: '#52000000', offsetX: 0, offsetY: 14 })
      .onClick(() => {})
    }
    .width('100%')
    .height('100%')
    .alignContent(Alignment.Center)
    .backdropBlur(18)
    .backgroundColor($r('app.color.dialog_overlay'))
  }
}
