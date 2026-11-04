const yieldToBrowser = () => globalThis.scheduler?.yield?.() || new Promise(resolve => setTimeout(resolve, 0));

/** Independent preparation jobs only: a job must not await another job in this
 * queue. Include downstream promise callbacks in the time budget so publishing
 * decoded bytes cannot restart an unbounded microtask burst. */
export function cooperativeQueue({ budgetMs = 8, now = () => performance.now(), yieldTask = yieldToBrowser } = {}) {
  let tail = Promise.resolve(), sliceStart = now();
  return work => {
    const result = tail.then(async () => {
      if (now() - sliceStart >= budgetMs) { await yieldTask(); sliceStart = now(); }
      return work();
    });
    tail = result.catch(() => {});
    return result;
  };
}
