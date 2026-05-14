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
        .backgroundColor('#66000000')
        .onClick(() => {
          this.onCancel();
        })

      Column({ space: 16 }) {
        Text(this.title)
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#15233B')

        Text(this.content)
          .fontSize(14)
          .lineHeight(22)
          .fontColor('#5A6B83')
          .textAlign(TextAlign.Center)
          .width('100%')

        Row({ space: 12 }) {
          Button(this.cancelText)
            .layoutWeight(1)
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(15)
            .fontColor('#4C607A')
            .backgroundColor('#EEF3F9')
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
      .width('84%')
      .padding(22)
      .backgroundColor(Color.White)
      .borderRadius(28)
      .onClick(() => {})
    }
    .width('100%')
    .height('100%')
    .alignContent(Alignment.Center)
  }
}
