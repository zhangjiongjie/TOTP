@Entry
@Component
struct Index {
  build() {
    Column({ space: 12 }) {
      Text('TOTP Authenticator')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
      Text('HarmonyOS NEXT client bootstrap')
        .fontSize(16)
        .fontColor('#6B7A90')
      Text('Monorepo skeleton is ready for local vault and sync integration.')
        .fontSize(14)
        .fontColor('#8C98AA')
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .height('100%')
    .padding(24)
    .justifyContent(FlexAlign.Center)
  }
}
