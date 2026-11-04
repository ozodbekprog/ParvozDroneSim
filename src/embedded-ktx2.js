/** Narrow r180 backport of three.js #35193 (released in r187).
 * Keep GLTFLoader's texture/sampler/association handling, but send embedded
 * KTX2 buffer views straight to the configured transcoder. loadBufferView()
 * already copies the view, so worker transfers cannot detach the GLB itself.
 * Remove this adapter when qualifying an upstream loader with this support. */
export function directEmbeddedKtx2(parser) {
  const loadImageSource = parser.loadImageSource;
  parser.loadImageSource = function (sourceIndex, loader) {
    const source = this.json.images[sourceIndex];
    const isKtx2 = loader && (loader === this.options.ktx2Loader || loader.isKTX2Loader === true);
    if (source.bufferView === undefined || !isKtx2 || typeof loader.parse !== 'function') {
      return loadImageSource.call(this, sourceIndex, loader);
    }
    if (this.sourceCache[sourceIndex] !== undefined) {
      return this.sourceCache[sourceIndex].then(texture => texture.clone());
    }
    const promise = this.getDependency('bufferView', source.bufferView)
      .then(buffer => new Promise((resolve, reject) => loader.parse(buffer, resolve, reject)))
      .then(texture => {
        if (source.extras !== undefined) {
          if (typeof source.extras === 'object') Object.assign(texture.userData, source.extras);
          else console.warn('THREE.GLTFLoader: Ignoring primitive type .extras, ' + source.extras);
        }
        texture.userData.mimeType = source.mimeType || 'image/ktx2';
        return texture;
      });
    this.sourceCache[sourceIndex] = promise;
    return promise;
  };
}
