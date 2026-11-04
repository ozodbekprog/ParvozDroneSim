"""Extend the chosen worn scene using complete, licensed authored Blender assets.

This script imports/places/optimizes existing artwork, bakes contact AO and
exports spatial batches. It does not substitute primitive boxes for artwork.
The explicit collision sidecar uses invisible simplified architecture meshes.
"""
import bpy, bmesh, json, math, sys, os
from pathlib import Path
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).parent))
from runtime_export import export_material_batches
from ironworks_site import extend_site
from ironworks_chunks import export_site
from site_ground import partition_ground

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'content/source-assets'
OUT=Path(os.environ.get('IRONWORKS_OUTPUT_DIR',str(ROOT/'content/maps/ironworks-v2')))
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'content/review/ironworks/worn.blend'),load_ui=False,use_scripts=False)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
collection=next(c for c in scene.collection.children if c.name.startswith('Ironworks'))
library={};worlds={}
def append(asset):
    with bpy.data.libraries.load(str(SRC/asset/(asset+'.blend')),link=False) as (source,target):
        names=list(source.objects);target.objects=list(names)
    staging=bpy.data.collections.new('TEMP imported source');scene.collection.children.link(staging)
    for o in target.objects:
        if o:staging.objects.link(o)
    bpy.context.view_layer.update()
    library[asset]={name:o for name,o in zip(names,target.objects) if o}
    worlds[asset]={name:o.matrix_world.copy() for name,o in zip(names,target.objects) if o}
    bpy.data.collections.remove(staging)
    for image in bpy.data.images:
        if image.source!='FILE' or image.packed_file:continue
        matches=list((SRC/asset).rglob(Path(image.filepath.replace('\\','/')).name))
        if matches:image.filepath=str(matches[0]);image.reload()

for asset in ['modular_factory_facade','modular_industrial_pipes_01','industrial_pastic_container','industrial_storage_cart','hanging_industrial_lamp']:append(asset)
def place(asset,name,origin,destination,rotation=0,scale=1):
    source=library[asset][name]
    obj=source.copy();obj.data=source.data;obj.parent=None;obj.constraints.clear()
    collection.objects.link(obj)
    obj.matrix_world=Matrix.Translation(Vector(destination))@Matrix.Rotation(rotation,4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(-Vector(origin))@worlds[asset][name]
    obj.hide_render=False;obj['source_asset']=asset
    return obj
F='modular_factory_facade'
def facade(name,origin,destination,rotation=0):return place(F,name,origin,destination,rotation)

# Replace two lower back-wall bays with a second authored open loading portal.
# This forms a continuous through-flight warehouse, rather than a dead end.
removed=0
for obj in list(collection.objects):
    if obj.name.startswith('Warehouse ceiling'):
        bpy.data.objects.remove(obj,do_unlink=True);continue
    if obj.type=='MESH' and obj.name.startswith('wall_standard_standard'):
        points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
        p=sum(points,Vector())/8
        if abs(p.y-12)<.01 and abs(p.z-1.5)<.01 and (abs(p.x+1.5)<.01 or abs(p.x-1.5)<.01):
            bpy.data.objects.remove(obj,do_unlink=True);removed+=1
if removed!=2:raise ValueError('Expected exactly two rear wall bays, found '+str(removed))
facade('wall_door_garage_centered_01',(-16,0,0),(-3,12,0))
for obj in list(collection.objects):
    if obj.type!='MESH':continue
    points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
    center=sum(points,Vector())/8
    # The review's centre pier was ornamental. It cannot obstruct the new flight portal.
    if obj.name.startswith('wall_pier_standard') and abs(center.x)<.05 and abs(center.y-5.92)<.1 and center.z<2:
        bpy.data.objects.remove(obj,do_unlink=True)
    elif obj.name.startswith('concrete_road_barrier') and abs(center.y+3)<.1:
        destination=Vector((-7,0,center.z)) if center.x<-2 else Vector((-6,-5,center.z))
        obj.location+=destination-center

# Close the west wing and the warehouse's east side; retain separate interior
# surfaces and the source's window reveals, frames, sills and masonry trims.
for y in range(-6,12,3):
    for z in [0,3]:
        facade('wall_window_centered_large_01',(0,0,4),(-12,y,z),math.pi/2)
        facade('window_centered_large_01',(0,0,4),(-12,y,z),math.pi/2)
    facade('crown_standard_standard_01',(-20,0,7),(-12,y,6),math.pi/2)
for x in [-12,-9]:
    for z in [0,3]:facade('wall_standard_standard_01',(-20,0,0),(x,-6,z))
for y in [-6,12]:
    for z in [0,3]:facade('wall_standard_standard_01',(-20,0,0),(-12,y,z))

floor=next(o for o in collection.objects if o.name.startswith('Courtyard concrete'))
# Extend the original measured UV floor to cover the route around the warehouse.
for vertex in floor.data.vertices:vertex.co.x*=4/3;vertex.co.y*=4/3
for uv in floor.data.uv_layers.get('UVMap').data:uv.uv*=4/3
floor.data.update()
ceiling_mat=bpy.data.materials.new('Warehouse plaster ceiling');ceiling_mat.use_nodes=True
nodes,links=ceiling_mat.node_tree.nodes,ceiling_mat.node_tree.links
bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
for kind,file in json.loads((SRC/'painted_plaster_wall/SOURCE.json').read_text())['files'].items():
    node=nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(SRC/'painted_plaster_wall'/file['name']),check_existing=True)
    if kind!='diff':node.image.colorspace_settings.name='Non-Color'
    if kind=='diff':links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    elif kind=='rough':links.new(node.outputs['Color'],bsdf.inputs['Roughness'])
    elif kind=='nor_gl':
        normal=nodes.new('ShaderNodeNormalMap');links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
def surface(name,corners,uvs):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(corners,[],[tuple(range(len(corners)))]);mesh.materials.append(ceiling_mat)
    uv=mesh.uv_layers.new(name='UVMap')
    for loop,value in zip(uv.data,uvs):loop.uv=value
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj);return obj
surface('Warehouse roof slab',[(-9,6,6),(9,6,6),(9,12,6),(-9,12,6)],[(0,0),(4.5,0),(4.5,1.5),(0,1.5)])
surface('West wing roof',[(-12,-6,6),(-9,-6,6),(-9,12,6),(-12,12,6)],[(0,0),(.75,0),(.75,4.5),(0,4.5)])

# Interior columns are the authored fluted masonry pier, including their trims.
# They are beside the flight corridor; the two loading portals stay unobstructed.
for x in [-5.5,5.5]:
    for y in [8,10]:
        for z in [0,3]:facade('wall_pier_standard_01',(-28,0,0),(x,y,z))
        facade('cornice01_pier_standard_01',(-28,0,6),(x,y,5.9))

# Work bays and recognisable landmarks. Repetitions retain shared source meshes.
for x,y,angle in [(-6.5,8,0),(6.5,9,math.pi)]:
    place('industrial_storage_cart','industrial_storage_cart',(0,0,0),(x,y,.01),angle)
for x,y,angle in [(-6.8,10,0),(-6.1,10,0),(6.4,7,math.pi/2),(6.4,7.8,math.pi/2)]:
    for name,obj in library['industrial_pastic_container'].items():
        if obj.type=='MESH':place('industrial_pastic_container',name,(0,0,0),(x,y,.01),angle)
for x in [-5,0,5]:place('hanging_industrial_lamp','hanging_industrial_lamp',(0,0,0),(x,9,5.9))
P='modular_industrial_pipes_01'
for y in [7.3,9.25,11.2]:
    for x in [-8.6,8.6]:
        pipe=place(P,'modular_industrial_pipes_01_pipe02',(-.6,.025,0),(x,y,4.85))
        pipe.matrix_world=Matrix.Translation(Vector((x,y,4.85)))@Matrix.Rotation(math.pi/2,4,'X')@Matrix.Translation(-Vector((-.6,.025,0)))@worlds[P]['modular_industrial_pipes_01_pipe02']
for x,y in [(-8.6,7.2),(8.6,10.8)]:place(P,'modular_industrial_pipes_01_pipe08',(-.27,0,-.7),(x,y,2.2))

large_site=os.environ.get('IRONWORKS_YARD_ONLY')!='1'
zones=extend_site(ROOT,scene,collection,library,worlds,append,place,facade,surface) if large_site else []

# Normalized aperture asset: detailed flanged sections from the authored pipe
# kit. Its envelope matches the gate collision bars exactly; no solid base crosses
# the opening. Ground-level industrial arches are anchored into the concrete.
gate_collection=bpy.data.collections.new('Ironworks gate — authored pipe sections');scene.collection.children.link(gate_collection)
width,height,thickness=2.6,2.2,.208
pipe_source=library[P]['modular_industrial_pipes_01_pipe02']
points=[worlds[P]['modular_industrial_pipes_01_pipe02']@Vector(v) for v in pipe_source.bound_box]
minimum=Vector([min(p[a] for p in points) for a in range(3)])
maximum=Vector([max(p[a] for p in points) for a in range(3)])
mid=(minimum+maximum)/2;extent=maximum-minimum
gate_material=pipe_source.data.materials[0].copy();gate_material.name='Ironworks_gate_signal'
gate_objects=[]
for name,axis_length,position,angle in [
    ('Arch left',height,(-width/2-thickness/2,0,0),0),
    ('Arch right',height,(width/2+thickness/2,0,0),0),
    ('Arch lintel',width+2*thickness,(0,0,height/2+thickness/2),math.pi/2)]:
    obj=pipe_source.copy();obj.data=pipe_source.data.copy();obj.parent=None;obj.constraints.clear();gate_collection.objects.link(obj)
    normalize=Matrix.Diagonal((thickness/extent.x,thickness/extent.y,axis_length/extent.z,1))@Matrix.Translation(-mid)@worlds[P]['modular_industrial_pipes_01_pipe02']
    obj.data.transform(normalize);obj.matrix_world=Matrix.Translation(Vector(position))@Matrix.Rotation(angle,4,'Y')
    obj.name=name;obj.data.materials.clear();obj.data.materials.append(gate_material);gate_objects.append(obj)
gate_scene=bpy.data.scenes.new('Ironworks race arch source')
gate_scene.collection.children.link(gate_collection)
previous_scene=bpy.context.window.scene;bpy.context.window.scene=gate_scene
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'map.blend'),compress=True)
export_material_batches(OUT/'gate.raw.glb',lambda obj:False)
bpy.context.window.scene=previous_scene
# Gate artwork is an independent scene in the editable .blend; map export excludes it.
scene.collection.children.unlink(gate_collection)

# Collision: dissolve coplanar source wall faces while preserving door/window
# boundary loops. Mesh collisions remain two-sided and use the actual apertures.
colliders=[];collision_triangles=0
for obj in collection.objects:
    if obj.type!='MESH':continue
    if obj.name.startswith(('wall_','Warehouse roof','West wing roof')):
        mesh=obj.data.copy();bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.dissolve_limit(bm,angle_limit=.005,verts=list(bm.verts),edges=list(bm.edges),use_dissolve_boundaries=False)
        bm.to_mesh(mesh);bm.free();mesh.calc_loop_triangles()
        vertices=[]
        for tri in mesh.loop_triangles:
            for vi in tri.vertices:
                p=obj.matrix_world@mesh.vertices[vi].co;vertices.extend([round(p.x,5),round(p.z,5),round(-p.y,5)])
        collision_triangles+=len(mesh.loop_triangles)
        if vertices:colliders.append({'type':'mesh','vertices':vertices,'name':obj.name,'visible':False})
        bpy.data.meshes.remove(mesh)
    elif obj.name.startswith(('window_','concrete_road_barrier','metal_tool_chest','industrial_storage_cart','industrial_pastic_container','hanging_industrial_lamp','modular_industrial_pipes','overhead_crane','portable_generator','barrel_03','preset_03','modular_chainlink')):
        points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
        low=[min(p[a] for p in points) for a in range(3)];high=[max(p[a] for p in points) for a in range(3)]
        mid=[(low[a]+high[a])/2 for a in range(3)];size=[max(high[a]-low[a],.01) for a in range(3)]
        colliders.append({'position':[mid[0],mid[2],-mid[1]],'size':[size[0],size[2],size[1]],'visible':False,'name':obj.name})
if large_site:colliders.append({'position':[0,-.15,0],'size':[380,.2,320],'visible':False,'name':'Site terrain support'})
(OUT/'collision.json').write_text(json.dumps(colliders,separators=(',',':')),encoding='utf8')

# Delivery modifiers reduce furnishings, keeping curves round at flight distance.
# The editable .blend saves full source mesh data with reversible modifiers.
for obj in collection.objects:
    if obj.type!='MESH':continue
    if obj.name.startswith('industrial_storage_cart'):ratio=.35
    elif obj.name.startswith('hanging_industrial_lamp'):ratio=.3
    elif obj.name.startswith('industrial_pastic_container'):ratio=.5
    else:continue
    mod=obj.modifiers.new('Flight delivery simplification','DECIMATE');mod.ratio=ratio
for obj in collection.objects:
    if obj.type=='MESH':
        for mat in obj.data.materials:
            if mat:mat.use_backface_culling=False

# Re-bake the floor atlas against the completed architecture and furnishings.
ao=next(i for i in bpy.data.images if i.name.startswith('Ironworks courtyard baked AO'))
mat=floor.data.materials[0]
target=next(n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image==ao)
mat.node_tree.nodes.active=target
bpy.ops.object.select_all(action='DESELECT');floor.select_set(True);bpy.context.view_layer.objects.active=floor
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.bake.margin=8
bpy.ops.object.bake(type='AO',uv_layer='UVBake');ao.pack();floor.data.uv_layers.active_index=0
scene['art_direction']='02 worn — chosen by user 2026-10-08'
scene['asset_sources']='SOURCE.json — Poly Haven CC0; authoring files retained'
scene['acceptance_status']='Built candidate; final in-game Low acceptance and UHD620 measurement pending'
if large_site:partition_ground(collection)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'map.blend'),compress=True)
if large_site:
    delivery=export_site(OUT,collection)
    definition=json.loads((ROOT/'content/maps/ironworks-v2/map.json').read_text(encoding='utf8'))
    definition.update(delivery)
    definition.update({'name':'Ironworks — Industrial Site','description':'A 300 x 240 m industrial site: foundry, rail loading hall, maintenance depot, control tower, elevated pipe yard and open western flight field. The original courtyard is one small section.','bounds':{'min':[-150,-.04,-120],'max':[150,100,120]},'siteSizeMetres':[300,240],'zones':zones})
    (OUT/'map-definition.json').write_text(json.dumps(definition,indent=2),encoding='utf8')
else:export_material_batches(OUT/'model.raw.glb',lambda obj:False,cell_size=12,extra_uv='UVBake',instanced=lambda obj:obj.name.startswith(('industrial_pastic_container','hanging_industrial_lamp','modular_industrial_pipes_01_pipe02')))
(OUT/'preparation.json').write_text(json.dumps({'artDirection':'worn','collisionTriangles':collision_triangles,'collisionObjects':len(colliders),'gateAperture':[width,height],'gateThickness':thickness,'spatialCellMetres':32 if large_site else 12,'siteSizeMetres':[300,240] if large_site else [48,48],'spatialChunks':len(delivery['objects']) if large_site else 1,'groundPartitioned':large_site,'status':'candidate; acceptance pending'},indent=2))
print('IRONWORKS_V2_EXPORTED',OUT,flush=True)
