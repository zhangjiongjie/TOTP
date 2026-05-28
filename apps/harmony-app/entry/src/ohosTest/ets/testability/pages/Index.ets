@Entry
@Component
struct Index {
  build() {
    Row() {
      Column() {
        Text('TOTP Tests')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
      }
      .width('100%')
    }
    .height('100%')
  }
}
