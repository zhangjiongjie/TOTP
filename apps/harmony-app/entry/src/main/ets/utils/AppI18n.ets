import { common } from '@kit.AbilityKit';

export class AppI18n {
  static string(context: common.UIAbilityContext, resource: Resource, fallback: string): string {
    try {
      return context.resourceManager.getStringSync(resource);
    } catch (_error) {
      return fallback;
    }
  }

  static format(context: common.UIAbilityContext, resource: Resource, fallback: string, ...args: Array<string | number>): string {
    try {
      return context.resourceManager.getStringSync(resource, ...args);
    } catch (_error) {
      return AppI18n.formatFallback(fallback, args);
    }
  }

  static globalString(resource: Resource, fallback: string): string {
    try {
      return getContext().resourceManager.getStringSync(resource);
    } catch (_error) {
      return fallback;
    }
  }

  static globalFormat(resource: Resource, fallback: string, ...args: Array<string | number>): string {
    try {
      return getContext().resourceManager.getStringSync(resource, ...args);
    } catch (_error) {
      return AppI18n.formatFallback(fallback, args);
    }
  }

  private static formatFallback(template: string, args: Array<string | number>): string {
    let result: string = template;
    for (let index: number = 0; index < args.length; index++) {
      result = result.replace(`%${index + 1}$s`, `${args[index]}`);
      result = result.replace(`%${index + 1}$d`, `${args[index]}`);
    }
    return result;
  }
}
