"""Assemble licensed authored modules for the art-direction checkpoint.

No generated substitute buildings or drone. The .blend remains editable;
delivery batches are temporary and spatially bounded. This is a review slice.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).parent))
from runtime_export import export_material_batches
from neutral_concrete import neutral_concrete

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / 'content/source-assets'
OUT = ROOT / 'content/review/ironworks'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
library = {}
source_worlds = {}

def append_source(asset):
    path = SOURCES / asset / (asset + '.blend')
    with bpy.data.libraries.load(str(path), link=False) as (source, target):
        target.objects = source.objects
    library[asset] = {o.name: o for o in target.objects if o}
    # Library-loaded objects have stale identity matrix_world until evaluated in
    # a scene. Preserve the author's actual transforms before unlinking the kit.
    staging = bpy.data.collections.new('Source transform evaluation')
    bpy.context.scene.collection.children.link(staging)
    for obj in target.objects:
        if obj: staging.objects.link(obj)
    bpy.context.view_layer.update()
    source_worlds[asset] = {obj.name:obj.matrix_world.copy() for obj in target.objects if obj}
    bpy.data.collections.remove(staging)
    # Resolve author's relative texture references independently of the current file.
    for image in bpy.data.images:
        if image.source != 'FILE': continue
        matches = list(SOURCES.rglob(Path(image.filepath.replace('\\', '/')).name))
        if matches:
            image.filepath = str(matches[0]); image.reload()

for asset in ['modular_factory_facade', 'modular_industrial_pipes_01', 'concrete_road_barrier', 'metal_tool_chest']:
    append_source(asset)

collection = bpy.data.collections.new('Ironworks — authored modules')
bpy.context.scene.collection.children.link(collection)

def place(asset, name, origin, destination, rotation=0):
    source = library[asset][name]
    obj = source.copy(); obj.data = source.data
    obj.parent = None
    obj.constraints.clear()
    collection.objects.link(obj)
    obj.matrix_world = Matrix.Translation(Vector(destination)) @ Matrix.Rotation(rotation, 4, 'Z') @ Matrix.Translation(-Vector(origin)) @ source_worlds[asset][name]
    obj.hide_render = False
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE': obj.modifiers.remove(modifier)
    obj['source_asset'] = asset
    return obj

F = 'modular_factory_facade'
def facade(name, origin, destination, rotation=0):
    return place(F, name, origin, destination, rotation)

# North warehouse: six structural bays, an open loading portal and a second
# storey. Matched wall/window modules retain authored reveals, sills and trims.
for x in [-9, -6, 3, 6]:
    facade('wall_window_centered_large_01', (0,0,4), (x,6,0))
    facade('window_centered_large_01', (0,0,4), (x,6,0))
facade('wall_door_garage_centered_01', (-16,0,0), (-3,6,0))
for x in range(-9,9,3):
    facade('wall_window_tall_large_01', (-12,0,4), (x,6,3))
    facade('window_tall_large_01', (-12,0,4), (x,6,3))
    facade('cornice01_standard_standard_01', (-20,0,6), (x,6,3))
    facade('crown_standard_standard_01', (-20,0,7), (x,6,6))
    # Back wall: its front faces the interior of the warehouse.
    for z in [0,3]: facade('wall_standard_standard_01', (-20,0,0), (x,12,z))
for x in [-9,-6,-3,0,3,6,9]:
    for z in [0,3]: facade('wall_pier_standard_01', (-28,0,0), (x,5.96,z))

# West return and warehouse side walls, all built from the same original kit.
for y in range(-6,12,3):
    for z in [0,3]:
        facade('wall_window_centered_large_01', (0,0,4), (-9,y,z), math.pi/2)
        facade('window_centered_large_01', (0,0,4), (-9,y,z), math.pi/2)
    facade('crown_standard_standard_01', (-20,0,7), (-9,y,6), math.pi/2)
for y in [12,9]:
    for z in [0,3]: facade('wall_standard_standard_01', (-20,0,0), (9,y,z), -math.pi/2)

P = 'modular_industrial_pipes_01'
for x in [-8.6,-8.18]:
    for z in [.95,2.90,4.85]:
        place(P,'modular_industrial_pipes_01_pipe02',(-.6,0,0),(x,5.68,z))
    place(P,'modular_industrial_pipes_01_pipe08',(-.27,0,-.7),(x,5.65,1.15))
for x,y,angle in [(-4,-3,0),(0,-3,0),(6,1,math.pi/2)]:
    place('concrete_road_barrier','concrete_road_barrier_LOD3',(0,0,0),(x,y,.01),angle)
for name, source in library['metal_tool_chest'].items():
    if source.type == 'MESH' and not name.startswith('WGT') and len(source.data.polygons):
        place('metal_tool_chest',name,(0,0,0),(-5,4.5,.01))

def pbr(asset):
    definition = json.loads((SOURCES / asset / 'SOURCE.json').read_text())
    mat = bpy.data.materials.new(asset); mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    for kind, file in definition['files'].items():
        node = nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(SOURCES / asset / file['name']), check_existing=True)
        if asset == 'smooth_concrete_floor' and kind == 'diff': node.image = neutral_concrete(node.image)
        if kind != 'diff': node.image.colorspace_settings.name = 'Non-Color'
        if kind == 'diff': links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
        elif kind == 'rough': links.new(node.outputs['Color'], bsdf.inputs['Roughness'])
        elif kind == 'nor_gl':
            normal = nodes.new('ShaderNodeNormalMap')
            links.new(node.outputs['Color'], normal.inputs['Color']); links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
        elif kind == 'ao':
            group = bpy.data.node_groups.get('glTF Material Output')
            if not group:
                group = bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
                group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
            settings = nodes.new('ShaderNodeGroup'); settings.node_tree = group
            links.new(node.outputs['Color'],settings.inputs['Occlusion'])
    return mat

clean_floor = pbr('smooth_concrete_floor'); worn_floor = pbr('concrete_floor_worn_001')
painted = pbr('painted_plaster_wall')
# The ground and ceiling are planar construction surfaces with measured UV scale,
# not placeholder solid boxes standing in for buildings.
def surface(name, corners, uvs, mat):
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(corners, [], [(0,1,2,3)])
    mesh.materials.append(mat); uv = mesh.uv_layers.new(name='UVMap')
    for loop, value in zip(uv.data,uvs): loop.uv = value
    obj = bpy.data.objects.new(name,mesh); collection.objects.link(obj)
    return obj
ground = surface('Courtyard concrete — 4m texture repeat', [(-18,-18,0),(18,-18,0),(18,18,0),(-18,18,0)], [(0,0),(9,0),(9,9),(0,9)], worn_floor)
surface('Warehouse ceiling', [(-9,6,6),(9,6,6),(9,12,6),(-9,12,6)], [(0,0),(4.5,0),(4.5,1.5),(0,1.5)], worn_floor)

# Bake contact occlusion against the authored architecture. Separate atlas UVs
# preserve full tiled concrete detail while providing volume on Low (no shadows).
floor_ao = bpy.data.images.new('Ironworks courtyard baked AO', width=1024, height=1024)
floor_ao.colorspace_settings.name='Non-Color'
atlas=ground.data.uv_layers.new(name='UVBake')
for loop,value in zip(atlas.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=value
ground.data.uv_layers.active_index=1
nodes=worn_floor.node_tree.nodes
target=nodes.new('ShaderNodeTexImage');target.image=floor_ao;nodes.active=target
bpy.ops.object.select_all(action='DESELECT');ground.select_set(True);bpy.context.view_layer.objects.active=ground
bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=16
bpy.context.scene.render.bake.margin=8
bpy.ops.object.bake(type='AO', uv_layer='UVBake')
floor_ao.pack()
ground.data.uv_layers.active_index=0
for original in [clean_floor,worn_floor]:
    original.use_fake_user=True
# Give ground its own materials; the ceiling must not sample the ground AO atlas.
clean_floor=clean_floor.copy();worn_floor=worn_floor.copy()
for mat in [clean_floor,worn_floor]:
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    image=nodes.new('ShaderNodeTexImage');image.image=floor_ao
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='UVBake';links.new(uv.outputs['UV'],image.inputs['Vector'])
    settings=next(n for n in nodes if n.type=='GROUP' and n.node_tree.name=='glTF Material Output')
    links.new(image.outputs['Color'],settings.inputs['Occlusion'])

# Source project contains all variants as named materials. Original textured brick
# remains available; clean variant swaps wall infill to painted plaster.
brick = bpy.data.materials.get('modular_factory_facade_brick')
wall_meshes = {obj.data for obj in collection.objects if obj.type == 'MESH' and brick in list(obj.data.materials)}
for look in ['clean','worn','evening']:
    ground.data.materials[0] = clean_floor if look == 'clean' else worn_floor
    for mesh in wall_meshes:
        for i, mat in enumerate(mesh.materials):
            if mat in [brick,painted]: mesh.materials[i] = painted if look == 'clean' else brick
    bpy.context.scene['review_status'] = 'Art direction candidate; not accepted production map'
    bpy.context.scene['look'] = look
    bpy.context.scene['asset_sources'] = 'See content/source-assets/*/SOURCE.json'
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / (look + '.blend')), compress=True)
    export_material_batches(OUT / (look + '.raw.glb'), lambda obj:False, cell_size=12, extra_uv='UVBake')
print('IRONWORKS_REVIEW_EXPORTED', OUT, flush=True)
