export const HOME_ROUTE_BACK_EXIT: string = 'exit';
export const HOME_ROUTE_BACK_GO_HOME: string = 'goHome';
export const HOME_ROUTE_BACK_SELECT_HOME_TAB: string = 'selectHomeTab';

export class HomeBackAction {
  kind: string;
  shouldHandle: boolean;
  nextRoute: string;
  nextTabIndex: number;

  constructor(kind: string, shouldHandle: boolean, nextRoute: string, nextTabIndex: number) {
    this.kind = kind;
    this.shouldHandle = shouldHandle;
    this.nextRoute = nextRoute;
    this.nextTabIndex = nextTabIndex;
  }
}

export class HomeRoutePolicy {
  static resolveBackAction(activeRoute: string, activeTabIndex: number): HomeBackAction {
    if (activeRoute === 'edit') {
      return new HomeBackAction(HOME_ROUTE_BACK_GO_HOME, true, 'home', activeTabIndex);
    }
    if (activeTabIndex !== 0) {
      return new HomeBackAction(HOME_ROUTE_BACK_SELECT_HOME_TAB, true, activeRoute, 0);
    }
    return new HomeBackAction(HOME_ROUTE_BACK_EXIT, false, activeRoute, activeTabIndex);
  }
}
