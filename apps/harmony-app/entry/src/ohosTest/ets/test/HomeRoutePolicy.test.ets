import { describe, it, expect } from '@ohos/hypium';
import {
  HOME_ROUTE_BACK_EXIT,
  HOME_ROUTE_BACK_GO_HOME,
  HOME_ROUTE_BACK_SELECT_HOME_TAB,
  HomeBackAction,
  HomeRoutePolicy
} from '../../../main/ets/policies/HomeRoutePolicy';

export default function homeRoutePolicyTest(): void {
  describe('HomeRoutePolicy', () => {
    it('goes home when back is pressed from edit route', 0, () => {
      let action: HomeBackAction = HomeRoutePolicy.resolveBackAction('edit', 0);

      expect(action.kind).assertEqual(HOME_ROUTE_BACK_GO_HOME);
      expect(action.shouldHandle).assertTrue();
      expect(action.nextRoute).assertEqual('home');
      expect(action.nextTabIndex).assertEqual(0);
    });

    it('selects home tab when back is pressed from another tab', 0, () => {
      let action: HomeBackAction = HomeRoutePolicy.resolveBackAction('home', 2);

      expect(action.kind).assertEqual(HOME_ROUTE_BACK_SELECT_HOME_TAB);
      expect(action.shouldHandle).assertTrue();
      expect(action.nextRoute).assertEqual('home');
      expect(action.nextTabIndex).assertEqual(0);
    });

    it('lets system handle back on home tab', 0, () => {
      let action: HomeBackAction = HomeRoutePolicy.resolveBackAction('home', 0);

      expect(action.kind).assertEqual(HOME_ROUTE_BACK_EXIT);
      expect(action.shouldHandle).assertFalse();
      expect(action.nextRoute).assertEqual('home');
      expect(action.nextTabIndex).assertEqual(0);
    });
  });
}
