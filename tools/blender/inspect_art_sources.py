"""Inspect licensed authoring files without running embedded scripts or saving them."""
import bpy, json
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parents[2]
report = {}
for folder in (root / 'content/source-assets').iterdir():
    blends = list(folder.glob('*.blend'))
    if not blends:
        continue
    bpy.ops.wm.open_mainfile(filepath=str(blends[0]), load_ui=False, use_scripts=False)
    meshes = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH': continue
        points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
        obj.data.calc_loop_triangles()
        meshes.append({'name':obj.name, 'triangles':len(obj.data.loop_triangles), 'min':[round(min(v[a] for v in points),3) for a in range(3)], 'max':[round(max(v[a] for v in points),3) for a in range(3)], 'materials':[m.name for m in obj.data.materials if m]})
    report[folder.name] = {'objects': meshes, 'collections':[c.name for c in bpy.data.collections]}
path = root / 'data/art-source/inspection.json'
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(report, indent=2), encoding='utf-8')
print('ART_INSPECTION', path)
