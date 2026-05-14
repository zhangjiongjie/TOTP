export function getUnixTimeSeconds(timestamp = Date.now()): number {
  return Math.floor(timestamp / 1000);
}

export function getTotpCounter(period: number, timestamp = Date.now()): number {
  return Math.floor(getUnixTimeSeconds(timestamp) / period);
}

export function getSecondsUntilNextStep(
  period: number,
  timestamp = Date.now()
): number {
  const elapsed = getUnixTimeSeconds(timestamp) % period;
  return elapsed === 0 ? period : period - elapsed;
}
