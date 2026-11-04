import { cooperativeQueue } from './cooperative-queue.js';
import { directEmbeddedKtx2 } from './embedded-ktx2.js';

/** Pace embedded image views before decoding. KTX2 takes the direct binary
 * path; other images retain the loader's Blob/URL path. Transcoding still runs
 * concurrently in KTX2Loader's worker pool. directKtx2=false is the QA control. */
export function cooperativeImageViews(parser, { directKtx2 = true, ...options } = {}) {
  if (directKtx2) directEmbeddedKtx2(parser);
  const views = new Set((parser.json.images || []).map(image => image.bufferView).filter(index => index !== undefined));
  const enqueue = cooperativeQueue(options);
  return {
    name: 'PARVOZ_cooperative_image_views',
    loadBufferView(index) {
      if (!views.has(index) || parser.json.bufferViews[index].extensions?.EXT_meshopt_compression) return null;
      // Calling the parser's default handler directly avoids re-entering this
      // plugin. That handler depends only on its parent buffer, never another view.
      return enqueue(() => parser.loadBufferView(index));
    },
  };
}
