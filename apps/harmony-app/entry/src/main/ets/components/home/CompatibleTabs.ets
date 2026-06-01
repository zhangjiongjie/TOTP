@Component
export struct CompatibleTabs {
  @Link activeTabIndex: number;
  @BuilderParam homeContent: () => void;
  @BuilderParam addContent: () => void;
  @BuilderParam settingsContent: () => void;

  build() {
    Tabs({ barPosition: BarPosition.End, index: this.activeTabIndex }) {
      TabContent() {
        this.homeContent()
      }
      .tabBar(BottomTabBarStyle.of($r('app.media.nav_home'), $r('app.string.nav_home'))
        .iconStyle({ selectedColor: $r('app.color.color_tab_selected'), unselectedColor: $r('app.color.color_tab_unselected') })
        .labelStyle({ selectedColor: $r('app.color.color_tab_selected'), unselectedColor: $r('app.color.color_tab_unselected') }))

      TabContent() {
        this.addContent()
      }
      .tabBar(BottomTabBarStyle.of($r('app.media.nav_add'), $r('app.string.nav_add'))
        .iconStyle({ selectedColor: $r('app.color.color_tab_selected'), unselectedColor: $r('app.color.color_tab_unselected') })
        .labelStyle({ selectedColor: $r('app.color.color_tab_selected'), unselectedColor: $r('app.color.color_tab_unselected') }))

      TabContent() {
        this.settingsContent()
      }
      .tabBar(BottomTabBarStyle.of($r('app.media.nav_settings'), $r('app.string.nav_settings'))
        .iconStyle({ selectedColor: $r('app.color.color_tab_selected'), unselectedColor: $r('app.color.color_tab_unselected') })
        .labelStyle({ selectedColor: $r('app.color.color_tab_selected'), unselectedColor: $r('app.color.color_tab_unselected') }))
    }
    .barOverlap(true)
    .barWidth('100%')
    .barHeight(76)
    .vertical(false)
    .animationDuration(0)
    .width('100%')
    .height('100%')
    .onChange((index: number) => {
      this.activeTabIndex = index;
    })
  }
}
