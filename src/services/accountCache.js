// Legacy shared keys are intentionally left untouched: their owner is unknown.
export function createAccountCache(storage, uid) {
  if (!uid) throw new Error("account_required");
  const keyFor = (key) => `nevfit_account:${encodeURIComponent(uid)}:${key}`;
  return {
    getItem: (key) => storage.getItem(keyFor(key)),
    setItem: (key, value) => storage.setItem(keyFor(key), value),
    removeItem: (key) => storage.removeItem(keyFor(key)),
  };
}
