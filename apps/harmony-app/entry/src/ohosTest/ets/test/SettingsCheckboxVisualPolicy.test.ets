import { describe, it, expect } from '@ohos/hypium';
import { SettingsCheckboxVisualPolicy } from '../../../main/ets/policies/SettingsCheckboxVisualPolicy';

export default function settingsCheckboxVisualPolicyTest(): void {
  describe('SettingsCheckboxVisualPolicy', () => {
    it('keeps the unchecked WebDAV checkbox visible on light cards', 0, () => {
      let contrast: number = SettingsCheckboxVisualPolicy.contrastRatio(
        SettingsCheckboxVisualPolicy.LIGHT_UNCHECKED_OUTLINE_HEX,
        SettingsCheckboxVisualPolicy.LIGHT_CARD_BACKGROUND_HEX
      );

      expect(contrast >= 3.0).assertTrue();
    });

    it('keeps the shared light control surface subtle', 0, () => {
      let contrast: number = SettingsCheckboxVisualPolicy.contrastRatio(
        SettingsCheckboxVisualPolicy.LIGHT_CONTROL_SURFACE_HEX,
        SettingsCheckboxVisualPolicy.LIGHT_CARD_BACKGROUND_HEX
      );

      expect(SettingsCheckboxVisualPolicy.LIGHT_CONTROL_SURFACE_HEX).assertEqual('#EEF3F8');
      expect(contrast >= 1.05).assertTrue();
    });

    it('keeps the parse button softer than the save button', 0, () => {
      let parseToInputContrast: number = SettingsCheckboxVisualPolicy.contrastRatio(
        SettingsCheckboxVisualPolicy.LIGHT_PRIMARY_SOFT_HEX,
        SettingsCheckboxVisualPolicy.LIGHT_CONTROL_SURFACE_HEX
      );
      let saveToInputContrast: number = SettingsCheckboxVisualPolicy.contrastRatio(
        SettingsCheckboxVisualPolicy.LIGHT_PRIMARY_HEX,
        SettingsCheckboxVisualPolicy.LIGHT_CONTROL_SURFACE_HEX
      );

      expect(SettingsCheckboxVisualPolicy.LIGHT_PRIMARY_SOFT_HEX).assertEqual('#DCEBFA');
      expect(parseToInputContrast < saveToInputContrast).assertTrue();
    });
  });
}