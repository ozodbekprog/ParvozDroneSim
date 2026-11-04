import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {ULTRA_LOADING_SHOTS,shuffledLoadingShots} from '../src/loading-gallery.js';
test('loading gallery uses verified full HD Ultra game frames from distinct maps',async()=>{
 const {captures}=JSON.parse(readFileSync('src/assets/loading/captures.json'));assert.equal(captures.length,ULTRA_LOADING_SHOTS.length);assert.ok(new Set(captures.map(c=>c.map)).size>=3);
 for(const capture of captures){assert.equal(capture.quality,'ultra');assert.deepEqual(capture.framebuffer,[1920,1080]);assert.equal(capture.adaptiveResolution,false);
  const bytes=readFileSync('src/assets/loading/'+capture.file),meta=await sharp(bytes).metadata();assert.equal(meta.width,1920);assert.equal(meta.height,1080);assert.equal(createHash('sha256').update(bytes).digest('hex'),capture.sha256);
 }
 assert.deepEqual([...shuffledLoadingShots(()=>0)].sort(),[...ULTRA_LOADING_SHOTS].sort());assert.notDeepEqual(shuffledLoadingShots(()=>0),ULTRA_LOADING_SHOTS,'the first map must not be fixed on every launch');
});
