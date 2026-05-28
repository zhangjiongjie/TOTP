import { abilityDelegatorRegistry, TestRunner } from '@kit.TestKit';
import { Want } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

let abilityDelegator: abilityDelegatorRegistry.AbilityDelegator;
let abilityDelegatorArguments: abilityDelegatorRegistry.AbilityDelegatorArgs;
let tag: string = 'TotpTestRunner';

async function onAbilityCreateCallback(): Promise<void> {
  hilog.info(0x0000, tag, '%{public}s', 'TestAbility created');
}

async function addAbilityMonitorCallback(error: BusinessError | null): Promise<void> {
  if (error !== null && error !== undefined && error.code !== 0) {
    hilog.error(0x0000, tag, 'addAbilityMonitor failed: %{public}s', JSON.stringify(error));
  }
}

export default class OpenHarmonyTestRunner implements TestRunner {
  onPrepare(): void {
    hilog.info(0x0000, tag, '%{public}s', 'OpenHarmonyTestRunner onPrepare');
  }

  onRun(): void {
    abilityDelegatorArguments = abilityDelegatorRegistry.getArguments();
    abilityDelegator = abilityDelegatorRegistry.getAbilityDelegator();
    let moduleName: string = abilityDelegatorArguments.parameters['-m'];
    let bundleName: string = abilityDelegatorArguments.bundleName;
    let testAbilityName: string = 'TestAbility';
    let monitor: abilityDelegatorRegistry.AbilityMonitor = {
      abilityName: testAbilityName,
      onAbilityCreate: onAbilityCreateCallback,
      moduleName: moduleName
    };

    abilityDelegator.addAbilityMonitor(monitor, addAbilityMonitorCallback);
    let want: Want = {
      bundleName: bundleName,
      abilityName: testAbilityName,
      moduleName: moduleName
    };
    abilityDelegator.startAbility(want, (error: BusinessError | null) => {
      if (error !== null && error !== undefined && error.code !== 0) {
        hilog.error(0x0000, tag, 'startAbility failed: %{public}s', JSON.stringify(error));
      }
    });
  }
}
