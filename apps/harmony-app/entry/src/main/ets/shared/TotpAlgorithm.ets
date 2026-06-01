import { AppI18n } from '../utils/AppI18n';

const SUPPORTED_ALGORITHMS: string[] = ['SHA1', 'SHA256', 'SHA512'];

/**
 * 统一规范化 TOTP 算法字符串（大小写、空白处理）。
 * 仅做格式规范化，不判断是否支持——由调用方决定如何处理未知值。
 */
export function normalizeTotpAlgorithm(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * 检查规范化后的算法值是否为支持的算法。
 */
export function isSupportedTotpAlgorithm(normalizedAlgorithm: string): boolean {
  return SUPPORTED_ALGORITHMS.indexOf(normalizedAlgorithm) >= 0;
}

/**
 * 规范化并断言算法受支持，不受支持时抛出明确错误。
 * 适用于运行时（验证码计算）场景——数据异常时应当让用户可见。
 */
export function requireTotpAlgorithm(value: string): string {
  let normalized: string = normalizeTotpAlgorithm(value);
  if (!isSupportedTotpAlgorithm(normalized)) {
    throw new Error(AppI18n.globalFormat($r('app.string.error_totp_algorithm_unsupported'), 'Unsupported algorithm: %1$s. Only SHA1, SHA256, and SHA512 are supported.', value));
  }
  return normalized;
}

/**
 * 规范化算法，不受支持时静默回退为默认值。
 * 适用于编辑器/导入场景——保证最终写入存储的数据有效。
 */
export function resolveTotpAlgorithm(value: string, fallback: string = 'SHA1'): string {
  let normalized: string = normalizeTotpAlgorithm(value);
  return isSupportedTotpAlgorithm(normalized) ? normalized : fallback;
}
