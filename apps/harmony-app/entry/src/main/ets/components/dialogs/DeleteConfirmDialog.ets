@Component
export struct DeleteConfirmDialog {
  title: ResourceStr = $r('app.string.delete_confirm_title');
  content: ResourceStr = $r('app.string.delete_account_message');
  confirmText: ResourceStr = $r('app.string.action_delete');
  cancelText: ResourceStr = $r('app.string.action_cancel');
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
            .backgroundColor($r('app.color.color_control_surface'))
            .onClick(() => {
              this.onCancel();
            })

          Button(this.confirmText)
            .layoutWeight(1)
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(15)
            .fontColor($r('sys.color.ohos_id_color_foreground_contrary'))
            .backgroundColor($r('app.color.color_danger_strong'))
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
      .shadow({ radius: 28, color: $r('app.color.color_dialog_shadow'), offsetX: 0, offsetY: 14 })
      .onClick(() => {})
    }
    .width('100%')
    .height('100%')
    .alignContent(Alignment.Center)
    .backdropBlur(18)
    .backgroundColor($r('app.color.dialog_overlay'))
  }
}
