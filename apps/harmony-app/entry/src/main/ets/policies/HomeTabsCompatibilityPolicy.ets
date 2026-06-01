export class HomeTabsCompatibilityPolicy {
  static supportsHdsMaterialTabs(distributionOSApiVersion: number): boolean {
    return distributionOSApiVersion >= 60100;
  }
}
