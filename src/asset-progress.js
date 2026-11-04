export function flightAssetURLs(map, builds, extraObjects = [], selectedTrack, {course=true}={}) {
  const urls = new Set();
  const visit = value => {
    if (typeof value === 'string' && value.startsWith('/content/assets/')) urls.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) if (key !== 'thumbnail' && !(key==='collisionFile'&&value.preparedCollisionFile)) visit(item);
  };
  const {garage,tracks,...environment}=map;
  visit({...environment,tracks:course?(selectedTrack?[selectedTrack]:tracks):[]});
  for(const build of builds){
    const {accessories,visualDetails,...aircraft}=build;visit(aircraft);
    if(visualDetails?.frameNode||visualDetails?.batteryNodes?.[build.batteryId])visit(visualDetails);
    if(build.actionCamera)visit(accessories?.actionCamera);
  }
  visit(extraObjects);
  return [...urls];
}

export class AssetProgress {
  constructor(urls, assets = []) {
    const sizes = new Map(assets.map(asset => [asset.url, asset.bytes]));
    this.files = new Map([...new Set(urls)].map(url => [url, { loaded: 0, total: sizes.get(url) || 0, done: false }]));
    this.lastLoaded = 0;
  }
  update(url, loaded, total = 0, done = false) {
    const file = this.files.get(url);
    if (!file) return this.value();
    file.loaded = Math.max(file.loaded, loaded || 0);
    file.total = Math.max(file.total, total || 0, file.loaded);
    file.done ||= done;
    return this.value();
  }
  value() {
    const files = [...this.files.values()];
    const loaded = files.reduce((sum, file) => sum + file.loaded, 0);
    this.lastLoaded = Math.max(this.lastLoaded, loaded);
    return { loaded: this.lastLoaded, total: files.reduce((sum, file) => sum + file.total, 0), done: files.every(file => file.done), filesDone: files.filter(file => file.done).length, files: files.length };
  }
}
