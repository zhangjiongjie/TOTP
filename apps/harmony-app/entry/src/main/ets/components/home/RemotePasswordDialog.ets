@Component
export struct RemotePasswordDialog {
  @Prop password: string = '';
  @Prop errorMessage: string = '';
  @Prop isBusy: boolean = false;
  onPasswordChange: (value: string) => void = (_value: string) => {};
  onVerify: () => void = () => {};
  onCancel: () => void = () => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Column({ space: 14 }) {
        Text($r('app.string.remote_password_title'))
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('sys.color.font_primary'))
          .width('100%')

        Text($r('app.string.remote_password_body'))
          .fontSize(14)
          .lineHeight(22)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')

        Text($r('app.string.remote_password_hint'))
          .fontSize(13)
          .lineHeight(20)
          .fontColor($r('app.color.dialog_accent_text'))
          .width('100%')

        TextInput({ text: this.password, placeholder: $r('app.string.remote_password_placeholder') })
          .type(InputType.Password)
          .height(46)
          .fontSize(15)
          .backgroundColor($r('sys.color.comp_background_gray'))
          .borderRadius(14)
          .padding({ left: 14, right: 14 })
          .enabled(!this.isBusy)
          .onChange((value: string) => {
            this.onPasswordChange(value);
          })

        if (this.errorMessage.length > 0) {
          Text(this.errorMessage)
            .fontSize(13)
            .lineHeight(20)
            .fontColor($r('app.color.color_danger'))
            .width('100%')
        }

        Row({ space: 10 }) {
          Button($r('app.string.remote_password_cancel'))
            .height(42)
            .layoutWeight(1)
            .enabled(!this.isBusy)
            .backgroundColor($r('sys.color.comp_background_gray'))
            .fontColor($r('sys.color.font_primary'))
            .onClick(() => {
              this.onCancel();
            })

          Button(this.isBusy ? $r('app.string.action_verifying') : $r('app.string.action_verify'))
            .height(42)
            .layoutWeight(1)
            .enabled(!this.isBusy)
            .backgroundColor($r('app.color.color_primary'))
            .fontColor($r('sys.color.ohos_id_color_foreground_contrary'))
            .onClick(() => {
              this.onVerify();
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
    }
    .width('100%')
    .height('100%')
    .backdropBlur(18)
    .backgroundColor($r('app.color.dialog_overlay'))
  }
}
