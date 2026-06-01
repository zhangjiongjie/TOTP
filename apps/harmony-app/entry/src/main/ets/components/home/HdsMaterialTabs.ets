import { Available } from '@kit.BasicServicesKit';
import { HdsTabs, hdsMaterial } from '@kit.UIDesignKit';

@Available({ minApiVersion: 'HarmonyOS 6.1.0' })
@Component
export struct HdsMaterialTabs {
  @Link activeTabIndex: number;
  @BuilderParam homeContent: () => void;
  @BuilderParam addContent: () => void;
  @BuilderParam settingsContent: () => void;

  build() {
    HdsTabs({ index: this.activeTabIndex }) {
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
    .barPosition(BarPosition.End)
    .vertical(false)
    .animationDuration(0)
    .barFloatingStyle({
      barWidth: {
        smallWidth: 304,
        mediumWidth: 404,
        largeWidth: 504
      },
      barBottomMargin: 18,
      systemMaterialEffect: {
        materialType: hdsMaterial.MaterialType.IMMERSIVE,
        materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
      }
    })
    .width('100%')
    .height('100%')
    .onChange((index: number) => {
      this.activeTabIndex = index;
    })
  }
}
