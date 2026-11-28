/**
 * In-memory distributed mutex lock to prevent concurrent double-click race conditions.
 */
const activeLocks = new Map<string, number>();

// Safety timeout: automatically release any lock after 15 seconds to prevent deadlocks
const LOCK_TIMEOUT_MS = 15000;

export async function withActionLock<T>(
  key: string,
  fn: () => Promise<T>,
  busyMessage: string = '⏳ An action is already processing for your account. Please wait a moment.'
): Promise<T> {
  const now = Date.now();
  const existingTime = activeLocks.get(key);

  if (existingTime && now - existingTime < LOCK_TIMEOUT_MS) {
    throw new Error(busyMessage);
  }

  activeLocks.set(key, now);
  try {
    return await fn();
  } finally {
    activeLocks.delete(key);
  }
}
