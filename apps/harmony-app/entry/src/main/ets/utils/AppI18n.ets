import { common } from '@kit.AbilityKit';

export class AppI18n {
  private static globalContext: common.UIAbilityContext | undefined = undefined;

  static setGlobalContext(context: common.UIAbilityContext): void {
    AppI18n.globalContext = context;
  }

  static clearGlobalContext(): void {
    AppI18n.globalContext = undefined;
  }

  static string(context: common.UIAbilityContext, resource: Resource, fallback: string): string {
    try {
      return context.resourceManager.getStringSync(resource.id);
    } catch (_error) {
      return fallback;
    }
  }

  static format(context: common.UIAbilityContext, resource: Resource, fallback: string, ...args: Array<string | number>): string {
    try {
      return context.resourceManager.getStringSync(resource.id, ...args);
    } catch (_error) {
      return AppI18n.formatFallback(fallback, args);
    }
  }

  static globalString(resource: Resource, fallback: string): string {
    try {
      if (AppI18n.globalContext === undefined) {
        return fallback;
      }
      return AppI18n.globalContext.resourceManager.getStringSync(resource.id);
    } catch (_error) {
      return fallback;
    }
  }

  static globalFormat(resource: Resource, fallback: string, ...args: Array<string | number>): string {
    try {
      if (AppI18n.globalContext === undefined) {
        return AppI18n.formatFallback(fallback, args);
      }
      return AppI18n.globalContext.resourceManager.getStringSync(resource.id, ...args);
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
