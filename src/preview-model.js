/** Download/parse the aircraft while its environment is being prepared. A new
 * model remains detached until both are ready; abandoned models own no GPU or
 * download resources after cancellation or an environment failure. */
export async function preparePreviewModel(environmentReady, create, dispose, { signal } = {}) {
  signal?.throwIfAborted();
  const mesh = create();
  let released = false, abort;
  const release = () => { if (!released) { released = true; dispose(mesh); } };
  const canceled = new Promise((_, reject) => {
    abort = () => { release(); reject(signal.reason || new DOMException('Canceled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
  });
  try {
    await Promise.race([Promise.all([environmentReady, mesh.assetsReady]), canceled]);
    signal?.throwIfAborted();
    return mesh;
  } catch (error) { release(); throw error; }
  finally { signal?.removeEventListener('abort', abort); }
}
