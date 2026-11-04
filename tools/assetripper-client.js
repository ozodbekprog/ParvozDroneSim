import {profile} from './content-import-profile.js';
export const assetKey=(c,id)=>JSON.stringify(c)+':'+id;
const parse=text=>JSON.parse(text.replace(/("m_PathID"\s*:\s*)(-?\d+)/g,'$1"$2"').replace(/(:\s*)(NaN|-?Infinity)(?=[,\s}])/g,'$1null'));
export class RipperClient {
  constructor(baseUrl=profile.assetRipperUrl){this.collections=new Map();this.baseUrl=baseUrl;}
  async get(url){const response=await fetch(this.baseUrl+url);if(!response.ok)throw new Error('AssetRipper '+response.status+' '+url);return response;}
  async collection(path){
    const key=JSON.stringify(path);if(this.collections.has(key))return this.collections.get(key);
    const html=await(await this.get('/Collections/View?Path='+encodeURIComponent(key))).text(),dependencies={0:path};
    for(const m of html.slice(html.indexOf('<h2>Dependencies')).matchAll(/<tr><td>(\d+)<\/td><td><a href="([^"]+)"/g))dependencies[m[1]]=JSON.parse(decodeURIComponent(m[2].split('Path=')[1]));
    const rows=[...html.matchAll(/<tr data-class="([^"]+)"><td>([^<]+)<\/td><td>[^<]+<\/td><td><a href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(m=>({type:m[1],id:m[2],name:m[4],collection:path}));
    const value={rows,dependencies};this.collections.set(key,value);return value;
  }
  async pointer(collection,p){if(!p||String(p.m_PathID)==='0')return null;const c=(await this.collection(collection)).dependencies[p.m_FileID];if(!c)throw new Error('Missing asset dependency');return{collection:c,id:String(p.m_PathID),key:assetKey(c,p.m_PathID)};}
  url(p,kind){return '/Assets/'+kind+'?Path='+encodeURIComponent('{"C":'+JSON.stringify(p.collection)+',"D":'+p.id+'}');}
  async json(p){return parse(await(await this.get(this.url(p,'Json'))).text());}
  async index(){
    const visited=new Set();
    const visit=async url=>{
      if(visited.has(url))return;visited.add(url);
      const html=await(await this.get(url)).text();
      for(const link of html.matchAll(/href="([^"]+)"/g)){
        if(link[1].startsWith('/Collections/'))await this.collection(JSON.parse(decodeURIComponent(link[1].split('Path=')[1])));
        else if(link[1].startsWith('/Bundles/'))await visit(link[1]);
      }
    };
    await visit('/Bundles/View?Path=%7B%22P%22%3A%5B%5D%7D');
    return [...this.collections.values()].flatMap(c=>c.rows);
  }
}
