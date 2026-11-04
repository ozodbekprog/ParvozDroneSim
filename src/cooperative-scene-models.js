const yieldToBrowser = () => globalThis.scheduler?.yield?.() || new Promise(resolve => setTimeout(resolve, 0));

function primaryURL(definition) {
  if (!definition) return '';
  if (typeof definition === 'string') return definition;
  return definition.modelLods?.[0]?.model || definition.model || '';
}

/** Order one representative per distinct asset URL first so every multi-file
 * environment begins network/decoder work immediately, then clone the remaining
 * thousands of spatial chunks in bounded cooperative slices. */
function seedDistinctURLs(items) {
  if (items.length <= 16) return items;
  const seen = new Set(), head = [], rest = [];
  for (const item of items) {
    const url = primaryURL(item);
    if (url && !seen.has(url) && head.length < 16) {
      seen.add(url);
      head.push(item);
    } else {
      rest.push(item);
    }
  }
  return head.length > 1 ? [...head, ...rest] : items;
}

export async function addVisualModelsCooperative(items, instantiate, {
  batchSize = 16,
  budgetMs = 8,
  now = () => performance.now(),
  yieldTask = yieldToBrowser,
  shouldContinue = () => true,
} = {}) {
  if (!items?.length) return [];
  const ordered = seedDistinctURLs(items);
  const results = [];
  let cursor = 0, sliceStart = now();
  while (cursor < ordered.length) {
    if (!shouldContinue()) throw new DOMException('Scene model instantiation canceled', 'AbortError');
    const slice = ordered.slice(cursor, cursor + batchSize);
    cursor += slice.length;
    const created = await Promise.all(slice.map(item => instantiate(item)));
    results.push(...created);
    if (!shouldContinue()) throw new DOMException('Scene model instantiation canceled', 'AbortError');
    if (cursor < ordered.length && now() - sliceStart >= budgetMs) {
      await yieldTask();
      sliceStart = now();
    }
  }
  return results;
}
