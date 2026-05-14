@Component
export struct AccountForm {
  @Link issuer: string;
  @Link accountName: string;
  @Link secret: string;
  @Link otpauthUri: string;
  @Link digits: string;
  @Link period: string;
  @Link algorithm: string;
  @Link groupName: string;

  onApplyUri: () => void = () => {};

  build() {
    Column({ space: 18 }) {
      this.buildImportCard()
      this.buildManualCard()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private buildImportCard(): void {
    Column({ space: 12 }) {
      Text('otpauth 链接')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))

      TextArea({ text: this.otpauthUri, placeholder: '粘贴 otpauth://totp/... 链接' })
        .width('100%')
        .height(108)
        .fontSize(14)
        .fontColor($r('sys.color.font_primary'))
        .backgroundColor($r('sys.color.comp_background_gray'))
        .borderRadius(18)
        .padding(14)
        .onChange((value: string) => {
          this.otpauthUri = value;
        })

      Button('解析')
        .width('100%')
        .height(44)
        .type(ButtonType.Capsule)
        .fontSize(15)
        .fontColor('#2E5B8F')
        .backgroundColor('#E8F0FB')
        .onClick(() => {
          this.onApplyUri();
        })
    }
    .width('100%')
    .padding(18)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(24)
  }

  @Builder
  private buildManualCard(): void {
    Column({ space: 14 }) {
      Text('账号信息')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))

      this.buildTextInput('发行方', '例如 GitHub / Google', this.issuer, (value: string) => {
        this.issuer = value;
      })

      this.buildTextInput('账号名称', '例如 name@example.com', this.accountName, (value: string) => {
        this.accountName = value;
      })

      this.buildTextInput('密钥 Secret', '输入 Base32 密钥', this.secret, (value: string) => {
        this.secret = value;
      })

      this.buildSelectInput(
        '分组',
        [
          { value: 'Default' },
          { value: 'Personal' },
          { value: 'Work' }
        ],
        this.resolveGroupIndex(),
        this.groupName,
        (value: string) => {
          this.groupName = value;
        }
      )

      Row({ space: 12 }) {
        Column({ space: 8 }) {
          Text('位数')
            .fontSize(13)
            .fontColor($r('sys.color.font_secondary'))

          TextInput({ text: this.digits, placeholder: '6' })
            .width('100%')
            .height(46)
            .fontSize(14)
            .fontColor($r('sys.color.font_primary'))
            .backgroundColor($r('sys.color.comp_background_gray'))
            .borderRadius(16)
            .padding({ left: 14, right: 14 })
            .onChange((value: string) => {
              this.digits = value;
            })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Column({ space: 8 }) {
          Text('周期')
            .fontSize(13)
            .fontColor($r('sys.color.font_secondary'))

          TextInput({ text: this.period, placeholder: '30' })
            .width('100%')
            .height(46)
            .fontSize(14)
            .fontColor($r('sys.color.font_primary'))
            .backgroundColor($r('sys.color.comp_background_gray'))
            .borderRadius(16)
            .padding({ left: 14, right: 14 })
            .onChange((value: string) => {
              this.period = value;
            })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')

      this.buildSelectInput(
        '算法',
        [
          { value: 'SHA1' },
          { value: 'SHA256' },
          { value: 'SHA512' }
        ],
        this.resolveAlgorithmIndex(),
        this.algorithm,
        (value: string) => {
          this.algorithm = value;
        }
      )
    }
    .width('100%')
    .padding(18)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(24)
  }

  @Builder
  private buildTextInput(
    label: string,
    placeholder: string,
    value: string,
    onValueChange: (value: string) => void
  ): void {
    Column({ space: 8 }) {
      Text(label)
        .fontSize(13)
        .fontColor($r('sys.color.font_secondary'))

      TextInput({ text: value, placeholder: placeholder })
        .width('100%')
        .height(46)
        .fontSize(14)
        .fontColor($r('sys.color.font_primary'))
        .backgroundColor($r('sys.color.comp_background_gray'))
        .borderRadius(16)
        .padding({ left: 14, right: 14 })
        .onChange((nextValue: string) => {
          onValueChange(nextValue);
        })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private buildSelectInput(
    label: string,
    options: SelectOption[],
    selectedIndex: number,
    value: string,
    onValueChange: (value: string) => void
  ): void {
    Column({ space: 8 }) {
      Text(label)
        .fontSize(13)
        .fontColor($r('sys.color.font_secondary'))

      Select(options)
        .selected(selectedIndex)
        .value(value)
        .width('100%')
        .height(46)
        .backgroundColor($r('sys.color.comp_background_gray'))
        .borderRadius(16)
        .font({ size: 14, weight: FontWeight.Medium })
        .fontColor($r('sys.color.font_primary'))
        .optionWidth(240)
        .onSelect((_index: number, text?: string) => {
          if (text !== undefined) {
            onValueChange(text);
          }
        })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  private resolveAlgorithmIndex(): number {
    let normalized: string = this.algorithm.trim().toUpperCase();
    if (normalized === 'SHA256') {
      return 1;
    }
    if (normalized === 'SHA512') {
      return 2;
    }
    return 0;
  }

  private resolveGroupIndex(): number {
    let normalized: string = this.groupName.trim().toLowerCase();
    if (normalized === 'personal') {
      return 1;
    }
    if (normalized === 'work') {
      return 2;
    }
    return 0;
  }
}
