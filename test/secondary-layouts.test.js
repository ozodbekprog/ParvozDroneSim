import test from 'node:test';import assert from 'node:assert/strict';
import {graphicsPanel} from '../src/graphics-layout.js';import {replayLibrary} from '../src/replay-layout.js';
import {flightMenuLayout} from '../src/pilot-menu-layouts.js';import {GRAPHICS_PRESETS} from '../src/graphics-settings.js';
test('grouped graphics retains every bound toggle and exactly one control for each saved value',()=>{
  const markup=graphicsPanel({...GRAPHICS_PRESETS.ultra,quality:'ultra',adaptiveResolution:true});
  for(const id of ['fullscreen-toggle','graphics-resolution','graphics-exposure','graphics-lod','graphics-textures','resolution-size'])assert.equal((markup.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
  for(const key of ['adaptiveResolution','reflections','normalMaps','shadows','antialiasing','ambientOcclusion','bloom','sunShafts','clouds','motionBlur'])assert.equal((markup.match(new RegExp(`data-graphic="${key}"`,'g'))||[]).length,1,key);
  assert.match(markup,/data-preset="ultra"[^>]*aria-pressed="true"/);assert.match(markup,/value="0" selected/);
});
test('replay metadata and action identities are escaped without reading full replay frames',()=>{
  const record={id:'a" onfocus="bad',name:'<Pilot>',map:'map',duration:1234,createdAt:0};
  const markup=replayLibrary([record],{map:{name:'<Map>',thumbnail:'/map.png'}},{formatTime:()=> '00:01.23'});
  assert.match(markup,/&lt;Pilot&gt;/);assert.match(markup,/&lt;Map&gt;/);assert.match(markup,/a&quot; onfocus=&quot;bad/);assert.doesNotMatch(markup,/<Pilot>|<Map>|id="a" onfocus/);
  for(const action of ['watch','rename','delete'])assert.match(markup,new RegExp(`data-${action}=`));
  const empty=replayLibrary([],{});assert.match(empty,/data-action="home-fly"/);assert.doesNotMatch(empty,/data-watch/);
});
test('pause room information is persistent rather than expanding the action panel',()=>{
  const markup=flightMenuLayout({solo:false,roster:'<div class="pause-roster">Pilot</div>',chat:'<section class="room-chat">Chat</section>'});
  assert.match(markup,/flight-chat-panel/);assert.match(markup,/has-room/);assert.doesNotMatch(markup,/<details|<summary/);
  for(const action of ['continue-flight','settings','leave'])assert.match(markup,new RegExp(`data-action="${action}"`));
});
