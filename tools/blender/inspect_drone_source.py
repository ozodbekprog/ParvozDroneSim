"""Import the licensed, authored drone; inventory geometry before adaptation."""
import bpy, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/art-source/husky'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'content/source-assets/3d-husky-drone/original.glb'))
bpy.context.view_layer.update()
report = {'blender': bpy.app.version_string, 'meshes': []}
for obj in bpy.context.scene.objects:
    obj.animation_data_clear()
    if obj.type != 'MESH': continue
    obj.data.calc_loop_triangles()
    ancestor = obj
    while ancestor.parent and ancestor.name not in ('SCOUT', 'HUNTER'):
        ancestor = ancestor.parent
    matrix = ancestor.matrix_world.inverted() @ obj.matrix_world
    points = [matrix @ Vector(v) for v in obj.bound_box]
    report['meshes'].append({'name': obj.name, 'variant': ancestor.name,
        'triangles': len(obj.data.loop_triangles), 'vertices': len(obj.data.vertices),
        'min': [round(min(v[a] for v in points), 4) for a in range(3)],
        'max': [round(max(v[a] for v in points), 4) for a in range(3)],
        'materials': [m.name for m in obj.data.materials if m]})
report['materials'] = [{ 'name': m.name, 'nodes': [n.bl_idname for n in m.node_tree.nodes]} for m in bpy.data.materials]
(OUT / 'inventory.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'imported.blend'), compress=True)
print('DRONE_INVENTORY', OUT / 'inventory.json', flush=True)
