@Component
export struct RemotePasswordDialog {
  password: string = '';
  errorMessage: string = '';
  isBusy: boolean = false;
  onPasswordChange: (value: string) => void = (_value: string) => {};
  onVerify: () => void = () => {};
  onCancel: () => void = () => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Column({ space: 14 }) {
        Text('验证远端密码库')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('sys.color.font_primary'))
          .width('100%')

        Text('远端主密码已变化，请输入新的远端主密码后继续同步。')
          .fontSize(14)
          .lineHeight(22)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')

        Text('验证通过后，本地保管库和当前解锁密码会同步更新为远端密码。')
          .fontSize(13)
          .lineHeight(20)
          .fontColor($r('app.color.dialog_accent_text'))
          .width('100%')

        TextInput({ text: this.password, placeholder: '远端主密码' })
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
            .fontColor('#C53D3D')
            .width('100%')
        }

        Row({ space: 10 }) {
          Button('稍后处理')
            .height(42)
            .layoutWeight(1)
            .enabled(!this.isBusy)
            .backgroundColor($r('sys.color.comp_background_gray'))
            .fontColor($r('sys.color.font_primary'))
            .onClick(() => {
              this.onCancel();
            })

          Button(this.isBusy ? '验证中...' : '验证')
            .height(42)
            .layoutWeight(1)
            .enabled(!this.isBusy)
            .backgroundColor('#2878C8')
            .fontColor(Color.White)
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
      .shadow({ radius: 28, color: '#52000000', offsetX: 0, offsetY: 14 })
    }
    .width('100%')
    .height('100%')
    .backdropBlur(18)
    .backgroundColor($r('app.color.dialog_overlay'))
  }
}
