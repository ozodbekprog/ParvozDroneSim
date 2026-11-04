"""Prepare an authored CC-BY-SA drone in Blender. Never generates its geometry.

The source download is untouched. Delivery copies are reduced independently;
rotor pivots remain separate from the chassis. This is an art-review candidate.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'content/review/kestrel'
TEMP = ROOT / 'data/art-build/kestrel'
OUT.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'content/source-assets/3d-husky-drone/original.glb'))
for obj in bpy.context.scene.objects: obj.animation_data_clear()
bpy.context.view_layer.update()
variant = bpy.data.objects['SCOUT']
inverse = variant.matrix_world.inverted()
# Source local: X left/right, Y up, Z fore/aft. Blender: Z up, -Y forward.
scale = .115 / math.hypot(12.4958, 15.1368)
orient = Matrix(((scale, 0, 0, 0), (0, 0, -scale, 0), (0, scale, 0, 0), (0, 0, 0, 1)))
meshes = []
for obj in list(bpy.context.scene.objects):
    ancestor = obj
    while ancestor.parent and ancestor != variant: ancestor = ancestor.parent
    if obj.type == 'MESH' and ancestor == variant:
        transform = orient @ inverse @ obj.matrix_world
        copy = obj.copy(); copy.data = obj.data.copy()
        copy.parent = None; copy.matrix_world = Matrix.Identity(4)
        copy.data.transform(transform)
        bpy.context.scene.collection.objects.link(copy)
        meshes.append(copy)
for obj in list(bpy.context.scene.objects):
    if obj not in meshes: bpy.data.objects.remove(obj, do_unlink=True)

for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    principled = next(n for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    # Decals use actual alpha; the body textures were incorrectly exported BLEND.
    if 'decal' not in mat.name.lower():
        for link in list(principled.inputs['Alpha'].links): mat.node_tree.links.remove(link)
        principled.inputs['Alpha'].default_value = 1
    else:
        mat.surface_render_method = 'DITHERED'
    mat.use_backface_culling = False

root = bpy.data.objects.new('Kestrel', None)
bpy.context.scene.collection.objects.link(root)
for obj in meshes:
    obj.parent = root
    obj.name = obj.name.removesuffix('.001')

rotor_names = []
for index, (sx, sz) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
    # Normalized source motor centers establish the physical pivots.
    pivot = Vector((sx * 12.4958 * scale, -sz * 15.1368 * scale, 1.25 * scale))
    rotor = bpy.data.objects.new(f'Rotor_{index}', None)
    bpy.context.scene.collection.objects.link(rotor); rotor.parent = root; rotor.location = pivot
    rotor_names.append(rotor.name)
    source_index = {(1,1):3, (-1,1):4, (-1,-1):1, (1,-1):2}[(sx,sz)]
    for obj in meshes:
        if obj.name.startswith(f'Prop_{source_index}_') or obj.name.startswith(f'Decal_motor_{source_index}_'):
            obj.data.transform(Matrix.Translation(-pivot)); obj.parent = rotor; obj.matrix_basis = Matrix.Identity(4)

def triangles(objects):
    total = 0
    for obj in objects: obj.data.calc_loop_triangles(); total += len(obj.data.loop_triangles)
    return total

# Inventory disconnected authored components for the subsequent modular split.
body = next(o for o in meshes if o.name == 'Scout_Scout_0')
inspection = body.copy(); inspection.data = body.data.copy()
bpy.context.scene.collection.objects.link(inspection)
bpy.ops.object.select_all(action='DESELECT'); inspection.select_set(True); bpy.context.view_layer.objects.active = inspection
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=.000001)
bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
components = []
for obj in list(bpy.context.selected_objects):
    points = [v.co for v in obj.data.vertices]
    components.append({'name':obj.name,'triangles':triangles([obj]),
        'min':[round(min(v[a] for v in points),5) for a in range(3)],
        'max':[round(max(v[a] for v in points),5) for a in range(3)]})
    bpy.data.objects.remove(obj,do_unlink=True)
(TEMP / 'components.json').write_text(json.dumps(components,indent=2),encoding='utf-8')
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes: obj.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'kestrel.blend'), compress=True)
report = {'sourceTriangles':triangles(meshes), 'rotors':rotor_names, 'scale':scale, 'levels':[]}
for label, ratio in (('hangar', .92), ('low', .245), ('far', .047)):
    copies = []
    for obj in meshes:
        obj.hide_set(True)
        copy = obj.copy(); copy.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(copy); copy.hide_set(False)
        # Decals are tiny but their shapes and UVs must survive reduction.
        if 'decal' not in obj.name.lower():
            bpy.context.view_layer.objects.active = copy
            modifier = copy.modifiers.new('Delivery reduction', 'DECIMATE')
            modifier.ratio = ratio
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        copy.name = obj.name + '_delivery'
        copies.append(copy)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in copies: obj.select_set(True)
    for obj in (root, *[bpy.data.objects[n] for n in rotor_names]): obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(TEMP / f'{label}.raw.glb'), export_format='GLB', use_selection=True,
        export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    report['levels'].append({'name':label,'triangles':triangles(copies)})
    for obj in copies: bpy.data.objects.remove(obj,do_unlink=True)
(OUT / 'preparation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('KESTREL_PREPARED', json.dumps(report), flush=True)
