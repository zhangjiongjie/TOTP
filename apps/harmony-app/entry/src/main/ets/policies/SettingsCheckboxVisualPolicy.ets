export class SettingsCheckboxVisualPolicy {
  static readonly LIGHT_CARD_BACKGROUND_HEX: string = '#F5F8FC';
  static readonly LIGHT_UNCHECKED_OUTLINE_HEX: string = '#667085';
  static readonly LIGHT_CONTROL_SURFACE_HEX: string = '#EEF3F8';
  static readonly LIGHT_PRIMARY_SOFT_HEX: string = '#DCEBFA';
  static readonly LIGHT_PRIMARY_HEX: string = '#1E5AA8';

  static contrastRatio(foregroundHex: string, backgroundHex: string): number {
    let foreground: number = SettingsCheckboxVisualPolicy.relativeLuminance(foregroundHex);
    let background: number = SettingsCheckboxVisualPolicy.relativeLuminance(backgroundHex);
    let lighter: number = foreground > background ? foreground : background;
    let darker: number = foreground > background ? background : foreground;
    return (lighter + 0.05) / (darker + 0.05);
  }

  private static relativeLuminance(hex: string): number {
    let red: number = SettingsCheckboxVisualPolicy.channelToLinear(SettingsCheckboxVisualPolicy.parseHexChannel(hex, 1));
    let green: number = SettingsCheckboxVisualPolicy.channelToLinear(SettingsCheckboxVisualPolicy.parseHexChannel(hex, 3));
    let blue: number = SettingsCheckboxVisualPolicy.channelToLinear(SettingsCheckboxVisualPolicy.parseHexChannel(hex, 5));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  private static parseHexChannel(hex: string, start: number): number {
    return Number.parseInt(hex.substring(start, start + 2), 16);
  }

  private static channelToLinear(channel: number): number {
    let normalized: number = channel / 255;
    if (normalized <= 0.03928) {
      return normalized / 12.92;
    }
    return Math.pow((normalized + 0.055) / 1.055, 2.4);
  }
}