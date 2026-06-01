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
      Text($r('app.string.account_form_import_title'))
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))

      TextArea({ text: this.otpauthUri, placeholder: $r('app.string.account_form_uri_placeholder') })
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

      Button($r('app.string.account_form_parse'))
        .width('100%')
        .height(44)
        .type(ButtonType.Capsule)
        .fontSize(15)
        .fontColor($r('app.color.color_primary_text'))
        .backgroundColor($r('app.color.color_primary_soft'))
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
      Text($r('app.string.account_form_info_title'))
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))

      this.buildTextInput($r('app.string.account_form_issuer_label'), $r('app.string.account_form_issuer_placeholder'), this.issuer, (value: string) => {
        this.issuer = value;
      })

      this.buildTextInput($r('app.string.account_form_account_label'), $r('app.string.account_form_account_placeholder'), this.accountName, (value: string) => {
        this.accountName = value;
      })

      this.buildTextInput($r('app.string.account_form_secret_label'), $r('app.string.account_form_secret_placeholder'), this.secret, (value: string) => {
        this.secret = value;
      })

      this.buildGroupSelectInput()

      Row({ space: 12 }) {
        Column({ space: 8 }) {
          Text($r('app.string.account_form_digits_label'))
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
          Text($r('app.string.account_form_period_label'))
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
        $r('app.string.account_form_algorithm_label'),
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
    label: ResourceStr,
    placeholder: ResourceStr,
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
    label: ResourceStr,
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

  @Builder
  private buildGroupSelectInput(): void {
    Column({ space: 8 }) {
      Text($r('app.string.account_form_group_label'))
        .fontSize(13)
        .fontColor($r('sys.color.font_secondary'))

      Select([
        { value: $r('app.string.account_form_group_default') },
        { value: $r('app.string.account_form_group_personal') },
        { value: $r('app.string.account_form_group_work') }
      ])
        .selected(this.resolveGroupIndex())
        .value(this.resolveGroupDisplayValue())
        .width('100%')
        .height(46)
        .backgroundColor($r('sys.color.comp_background_gray'))
        .borderRadius(16)
        .font({ size: 14, weight: FontWeight.Medium })
        .fontColor($r('sys.color.font_primary'))
        .optionWidth(240)
        .onSelect((index: number) => {
          this.groupName = this.resolveGroupValue(index);
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

  private resolveGroupDisplayValue(): ResourceStr {
    let index: number = this.resolveGroupIndex();
    if (index === 1) {
      return $r('app.string.account_form_group_personal');
    }
    if (index === 2) {
      return $r('app.string.account_form_group_work');
    }
    return $r('app.string.account_form_group_default');
  }

  private resolveGroupValue(index: number): string {
    if (index === 1) {
      return 'Personal';
    }
    if (index === 2) {
      return 'Work';
    }
    return 'Default';
  }
}
