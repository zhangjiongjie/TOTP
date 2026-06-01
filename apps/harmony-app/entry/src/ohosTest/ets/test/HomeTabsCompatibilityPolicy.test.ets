import { describe, it, expect } from '@ohos/hypium';
import { HomeTabsCompatibilityPolicy } from '../../../main/ets/policies/HomeTabsCompatibilityPolicy';

export default function homeTabsCompatibilityPolicyTest(): void {
  describe('HomeTabsCompatibilityPolicy', () => {
    it('uses compatible tabs below API 23', 0, () => {
      expect(HomeTabsCompatibilityPolicy.supportsHdsMaterialTabs(60002)).assertFalse();
    });

    it('uses HDS material tabs on HarmonyOS 6.1', 0, () => {
      expect(HomeTabsCompatibilityPolicy.supportsHdsMaterialTabs(60100)).assertTrue();
    });

    it('does not use HDS material tabs when distribution API is unavailable', 0, () => {
      expect(HomeTabsCompatibilityPolicy.supportsHdsMaterialTabs(0)).assertFalse();
    });
  });
}
