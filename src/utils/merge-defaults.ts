/**
 * Merges per-call options over module defaults, ignoring undefined values
 * so that absent request fields don't overwrite configured defaults.
 */
export function mergeWithDefaults<T extends object>(defaults: Partial<T>, options: T): T {
  const result = { ...defaults } as T;

  for (const key of Object.keys(options) as Array<keyof T>) {
    if (options[key] !== undefined) {
      result[key] = options[key];
    }
  }

  return result;
}
