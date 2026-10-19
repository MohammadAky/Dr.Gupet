/** A shared exclusive lock model for same-origin tab contention regressions. */
export function createGuestCartTestLocks() {
  let held = false;
  type Action = (lock: { name: string } | null) => unknown;
  return {
    request(name: string, optionsOrAction: { ifAvailable?: boolean } | Action, action?: Action) {
      const run = typeof optionsOrAction === 'function' ? optionsOrAction : action!;
      if (held) {
        if (typeof optionsOrAction !== 'function' && optionsOrAction.ifAvailable)
          return Promise.resolve().then(() => run(null));
        return Promise.reject(new Error('Unexpected uncoordinated transfer lock request'));
      }
      held = true;
      return Promise.resolve()
        .then(() => run({ name }))
        .finally(() => {
          held = false;
        });
    },
  };
}
