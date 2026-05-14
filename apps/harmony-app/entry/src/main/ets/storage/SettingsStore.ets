import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { BusinessError } from '@kit.BasicServicesKit';
import {
  WebDavSettings,
  createDefaultWebDavSettings,
  createWebDavSettingsFromJson
} from '../model/WebDavSettings';
import {
  WebDavSyncMetadata,
  createDefaultWebDavSyncMetadata,
  createWebDavSyncMetadataFromJson
} from '../model/WebDavSyncMetadata';

const STORE_NAME: string = 'totp_settings';
const WEBDAV_KEY: string = 'webdav.settings';
const WEBDAV_SYNC_META_KEY: string = 'webdav.sync.metadata';
const BIOMETRIC_UNLOCK_KEY: string = 'security.biometricUnlock.enabled';

export class SettingsStore {
  loadWebDavSettings(context: common.UIAbilityContext): WebDavSettings {
    try {
      let store: preferences.Preferences = this.getStore(context);
      let payload: string = store.getSync(WEBDAV_KEY, '') as string;
      if (payload.length === 0) {
        return createDefaultWebDavSettings();
      }
      return createWebDavSettingsFromJson(payload);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`load WebDAV settings failed: ${businessError.message}`);
    }
  }

  saveWebDavSettings(context: common.UIAbilityContext, settings: WebDavSettings): WebDavSettings {
    try {
      let store: preferences.Preferences = this.getStore(context);
      store.putSync(WEBDAV_KEY, JSON.stringify(settings.toRecord()));
      store.flushSync();
      return this.loadWebDavSettings(context);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`save WebDAV settings failed: ${businessError.message}`);
    }
  }

  loadWebDavSyncMetadata(context: common.UIAbilityContext): WebDavSyncMetadata {
    try {
      let store: preferences.Preferences = this.getStore(context);
      let payload: string = store.getSync(WEBDAV_SYNC_META_KEY, '') as string;
      if (payload.length === 0) {
        return createDefaultWebDavSyncMetadata();
      }
      return createWebDavSyncMetadataFromJson(payload);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`load WebDAV sync metadata failed: ${businessError.message}`);
    }
  }

  saveWebDavSyncMetadata(context: common.UIAbilityContext, metadata: WebDavSyncMetadata): WebDavSyncMetadata {
    try {
      let store: preferences.Preferences = this.getStore(context);
      store.putSync(WEBDAV_SYNC_META_KEY, JSON.stringify(metadata.toRecord()));
      store.flushSync();
      return this.loadWebDavSyncMetadata(context);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`save WebDAV sync metadata failed: ${businessError.message}`);
    }
  }

  loadBiometricUnlockEnabled(context: common.UIAbilityContext): boolean {
    try {
      let store: preferences.Preferences = this.getStore(context);
      return store.getSync(BIOMETRIC_UNLOCK_KEY, false) as boolean;
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`load biometric unlock setting failed: ${businessError.message}`);
    }
  }

  saveBiometricUnlockEnabled(context: common.UIAbilityContext, enabled: boolean): boolean {
    try {
      let store: preferences.Preferences = this.getStore(context);
      store.putSync(BIOMETRIC_UNLOCK_KEY, enabled);
      store.flushSync();
      return this.loadBiometricUnlockEnabled(context);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`save biometric unlock setting failed: ${businessError.message}`);
    }
  }

  private getStore(context: common.UIAbilityContext): preferences.Preferences {
    try {
      let options: preferences.Options = { name: STORE_NAME };
      return preferences.getPreferencesSync(context, options);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`open settings store failed: ${businessError.message}`);
    }
  }
}
