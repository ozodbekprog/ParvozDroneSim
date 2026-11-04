"""Import recovered authored geometry, material bindings and collider proxies.

Run after tools/recover-minus-two.js. --probe writes only a review area to data/.
The source Unity installation and existing game packages are never modified.
"""
import bpy, json, math, sys, re
from collections import OrderedDict
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
import numpy as np

sys.path.insert(0,str(Path(__file__).parent))
from import_profile import ROOT,RECOVERY,PROFILE,MAP_FOLDER
PROBE = '--probe' in sys.argv
resources = json.loads((RECOVERY / 'browser-resources.json').read_text())
records = json.loads((RECOVERY / resources['records']).read_text())
excluded_objects=set(json.loads((RECOVERY/'source-exclusions.json').read_text())['objects']) if (RECOVERY/'source-exclusions.json').exists() else set()
if not resources.get('textures'):
    raise RuntimeError('Texture recovery must succeed before scene assembly.')
B = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
F = Matrix.Diagonal(Vector((-1,1,1,1)))
transforms = {r['data']['m_GameObject']['m_PathID']:r['data'] for r in records.values() if r['type']=='Transform'}
mesh_filters = {r['data']['m_GameObject']['m_PathID']:r['data'] for r in records.values() if r['type']=='MeshFilter'}
world_cache, active_cache = {}, {}
def v(value): return Vector(tuple(value.get('m_'+axis,0) or 0 for axis in 'XYZ'))
def world(go):
    if go in world_cache:return world_cache[go]
    t=transforms.get(go)
    if not t:return Matrix.Identity(4)
    q=t['m_LocalRotation']
    if any(q.get('m_'+axis) is None for axis in 'WXYZ'):
        raise ValueError('Non-finite transform on '+go)
    m=Matrix.LocRotScale(v(t['m_LocalPosition']),Quaternion(tuple(q['m_'+a] for a in 'WXYZ')),v(t['m_LocalScale']))
    parent=t['m_Father']['m_PathID']
    if parent!='0':m=world(records[parent]['data']['m_GameObject']['m_PathID'])@m
    world_cache[go]=m
    return m
def active(go):
    if go in active_cache:return active_cache[go]
    if go not in transforms:return False
    r=records[go]
    parent=transforms[go]['m_Father']['m_PathID']
    value=bool(r['data']['m_IsActive']) and (parent=='0' or active(records[parent]['data']['m_GameObject']['m_PathID']))
    active_cache[go]=value
    return value
def key(collection,identity):return json.dumps(collection,separators=(',',':'))+':'+str(identity)
def pointer(collection,ptr):
    if not ptr or str(ptr['m_PathID'])=='0':return None
    dep=resources['collectionDependencies'][json.dumps(collection,separators=(',',':'))][str(ptr['m_FileID'])]
    return key(dep,ptr['m_PathID'])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Indoor ambient')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.18,.2,.24,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
visual=bpy.data.collections.new('Recovered '+PROFILE['map']['name']);scene.collection.children.link(visual)
proxy=bpy.data.collections.new('COLLISION_PROXIES');scene.collection.children.link(proxy);proxy.hide_render=True
from unity_materials import build_materials
materials,images,image=build_materials(resources,RECOVERY)

# AssetRipper flips Unity X, and Blender's glTF importer changes Y-up to Z-up.
mesh_cache={}
def mesh_parts(mesh_key):
    if mesh_key in mesh_cache:return mesh_cache[mesh_key]
    entry=next(e for e in resources['meshes'] if e['key']==mesh_key)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(RECOVERY/entry['file']))
    imported=set(bpy.data.objects)-before
    parts={}
    for obj in imported:
        if obj.type!='MESH':continue
        match=re.search(r'SubMesh_(\d+)',obj.name)
        index=int(match.group(1)) if match else len(parts)
        # Keep Blender's glTF conversion for UV0: export reverses it exactly.
        # Lightmap UVs are sampled directly as Unity coordinates, so only those
        # secondary layers need the source-oriented convention here.
        for layer in list(obj.data.uv_layers)[1:]:
            values=np.empty(len(layer.data)*2,dtype=np.float32)
            layer.data.foreach_get('uv',values);values[1::2]=1-values[1::2]
            layer.data.foreach_set('uv',values)
        parts[index]=obj.data
    for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
    mesh_cache[mesh_key]=parts
    return parts

lighting_pixels=OrderedDict()
lighting_files={entry['key']:entry['file'] for entry in resources['textures']}
def light_pixels(index):
    if index not in lighting_pixels:
        # HDR originals remain in recovery. Only their sampled vertex lighting
        # enters delivery; do not retain dozens of large float images in Blender.
        img=bpy.data.images.load(str(RECOVERY/lighting_files[resources['lightmaps'][index]]),check_existing=False)
        maximum=1024
        if max(img.size)>maximum:img.scale(maximum,maximum)
        w,h=img.size
        pixels=np.empty(w*h*4,dtype=np.float32);img.pixels.foreach_get(pixels)
        bpy.data.images.remove(img)
        lighting_pixels[index]=(pixels.reshape(h,w,4),w,h)
        if len(lighting_pixels)>4:lighting_pixels.popitem(last=False)
    lighting_pixels.move_to_end(index)
    return lighting_pixels[index]
def add_lighting(mesh,renderer,is_static):
    count=len(mesh.loops)
    colors=np.ones((count,4),dtype=np.float32)
    light_index=renderer.get('m_LightmapIndex',65535)
    if light_index<len(resources['lightmaps']) and resources['lightmaps'][light_index] and len(mesh.uv_layers)>1:
        uv=np.empty(count*2,dtype=np.float32);mesh.uv_layers[1].data.foreach_get('uv',uv);uv=uv.reshape(-1,2)
        if not is_static:
            st=renderer['m_LightmapTilingOffset']
            uv=uv*np.array([st['m_X'],st['m_Y']])+np.array([st['m_Z'],st['m_W']])
        pixels,w,h=light_pixels(light_index)
        x=np.clip((uv[:,0]*w).astype(int),0,w-1);y=np.clip((uv[:,1]*h).astype(int),0,h-1)
        # Adapt the original indirect light to the game's inexpensive hemisphere
        # lighting. Preserve its variation while keeping indoor surfaces readable.
        colors[:,:3]=np.clip(.55+np.sqrt(np.maximum(pixels[y,x,:3],0))*.8,.55,1.3)
    attribute=mesh.color_attributes.get('BakedLighting') or mesh.color_attributes.new(name='BakedLighting',type='FLOAT_COLOR',domain='CORNER')
    if 'terrainInstanceColor' in renderer:
        tint=int(renderer['terrainInstanceColor'])
        colors[:,:3]*=np.array([(tint>>(8*c)&255)/255 for c in range(3)],dtype=np.float32)
    attribute.data.foreach_set('color',colors.reshape(-1))

# Use one LOD per original LODGroup to avoid drawing overlapping variants.
excluded=set()
for record in records.values():
    if record['type']!='LODGroup':continue
    lods=record['data'].get('m_LODs',[])
    chosen=min(1,len(lods)-1)
    for index,lod in enumerate(lods):
        if index!=chosen:
            for ref in lod.get('m_Renderers',[]):excluded.add(str(ref.get('m_Renderer',ref)['m_PathID']))

created=[];invalid=[];probe_center=B@Vector(PROFILE['probe']['position']);probe_radius=PROFILE['probe']['radius']
for identity,record in records.items():
    if record['type']!='MeshRenderer' or identity in excluded:continue
    data=record['data'];go=data['m_GameObject']['m_PathID']
    # Unity ShadowsOnly renderers are invisible proxy geometry, not untextured scenery.
    if data.get('m_CastShadows')==3:continue
    if go in excluded_objects or not data['m_Enabled'] or not active(go) or go not in mesh_filters:continue
    try:source_world=world(go)
    except ValueError:invalid.append(go);continue
    is_static=data['m_StaticBatchInfo']['m_SubMeshCount']>0
    mesh_key=pointer(resources['scene'],mesh_filters[go]['m_Mesh'])
    if mesh_key is None:continue
    parts=mesh_parts(mesh_key)
    first=data['m_StaticBatchInfo']['m_FirstSubMesh'] if is_static else 0
    count=data['m_StaticBatchInfo']['m_SubMeshCount'] if is_static else len(parts)
    matrix=Matrix.Identity(4) if is_static else B@F@source_world@F@B.inverted()
    for local,index in enumerate(range(first,first+count)):
        if index not in parts:raise RuntimeError('Missing static submesh '+str(index)+' '+mesh_key)
        mesh=parts[index]
        if PROBE:
            coords=[matrix@vertex.co for vertex in mesh.vertices]
            if not coords:continue
            # Include large floors and ceilings that cross the review area.
            if (min(c.x for c in coords)>probe_center.x+probe_radius or max(c.x for c in coords)<probe_center.x-probe_radius
                or min(c.y for c in coords)>probe_center.y+probe_radius or max(c.y for c in coords)<probe_center.y-probe_radius):continue
        mesh=mesh.copy();mesh.materials.clear()
        refs=data.get('m_Materials',[])
        material_key=pointer(resources['scene'],refs[min(local,len(refs)-1)]) if refs else None
        if material_key not in materials:raise RuntimeError('Missing material for '+records[go]['name'])
        mesh.materials.append(materials[material_key])
        for poly in mesh.polygons:poly.material_index=0
        add_lighting(mesh,data,is_static)
        obj=bpy.data.objects.new(records[go]['name']+'_'+identity+'_'+str(index),mesh)
        visual.objects.link(obj);obj.matrix_world=matrix
        obj['source_game_object']=go;created.append(obj)
        if data.get('terrainDetail'):obj['terrainDetail']=True
    if len(created)%500==0:print('ASSEMBLED',len(created),flush=True)

report={'probe':PROBE,'objects':len(created),'triangles':sum(len(o.data.polygons) for o in created),'invalidTransforms':invalid,'excludedSourceObjects':len(excluded_objects)}
corners=[B.inverted()@(obj.matrix_world@Vector(corner)) for obj in created for corner in obj.bound_box]
report['bounds']={'min':[min(c[a] for c in corners) for a in range(3)],'max':[max(c[a] for c in corners) for a in range(3)]}
if not created:raise RuntimeError('No recovered geometry in selected review area.')
if not PROBE:
    # Keep editable collision proxies in the native authoring source.
    authoring=RECOVERY/'authoring';authoring.mkdir(exist_ok=True)
    (authoring/'collision.json').write_text(json.dumps(json.loads((RECOVERY/'collision.json').read_text())['items']))
    sys.path.insert(0,str(Path(__file__).parent))
    from export_package import add_collision_proxies
    report['collisionProxies']=add_collision_proxies(authoring)
for img in images.values():img.pack()
destination=RECOVERY/'probe.blend' if PROBE else MAP_FOLDER/'map.blend'
destination.parent.mkdir(parents=True,exist_ok=True)
(RECOVERY/('probe-report.json' if PROBE else 'assembly-report.json')).write_text(json.dumps(report,indent=2))
print('RECOVERY_REPORT',json.dumps(report),flush=True)

# Human review camera at pilot height, looking into the parking garage.
camera_data=bpy.data.cameras.new('Review pilot camera');camera=bpy.data.objects.new('Review pilot camera',camera_data)
scene.collection.objects.link(camera);scene.camera=camera;camera_data.lens=24
camera.location=B@Vector(PROFILE['probe']['position'])
target=B@Vector(PROFILE['probe']['target']);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
area_data=bpy.data.lights.new('Review fill','AREA');area_data.energy=450;area_data.shape='DISK';area_data.size=12
area=bpy.data.objects.new('Review fill',area_data);scene.collection.objects.link(area);area.location=camera.location+Vector((0,8,1.6))
scene.render.filepath=str(RECOVERY/('probe.png' if PROBE else 'assembled.png'))
if PROFILE.get('kind')=='prop-set':bpy.context.scene['liftoff_uv_convention_v2']=True
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
if '--no-render' not in sys.argv:bpy.ops.render.render(write_still=True)
