import { ConfigurationConstant, UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { UnlockService } from '../services/UnlockService';

const VAULT_SESSION_LOCKED_EVENT: string = 'totpVaultSessionLocked';

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        console.error(`Failed to load the content. Cause: ${JSON.stringify(err)}`);
        return;
      }

      console.info('Succeeded in loading the content.');
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    });
  }

  onBackground(): void {
    this.lockVaultSession();
  }

  onForeground(): void {
    this.context.eventHub.emit(VAULT_SESSION_LOCKED_EVENT);
  }

  onWindowStageDestroy(): void {
    this.lockVaultSession();
  }

  private lockVaultSession(): void {
    UnlockService.getInstance().lockSession();
  }
}
