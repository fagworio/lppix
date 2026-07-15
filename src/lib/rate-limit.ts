const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const requestStore = new Map<string, number[]>();

export function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const entries = requestStore.get(identifier) ?? [];
  const recentEntries = entries.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recentEntries.length >= MAX_REQUESTS_PER_WINDOW) {
    requestStore.set(identifier, recentEntries);
    return true;
  }

  recentEntries.push(now);
  requestStore.set(identifier, recentEntries);
  return false;
}
