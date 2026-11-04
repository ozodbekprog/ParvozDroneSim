"""Refresh only the existing clean review slice after its material correction."""
import bpy, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from runtime_export import export_material_batches
from neutral_concrete import neutral_concrete
root = Path(__file__).resolve().parents[2]
folder = root / 'content/review/ironworks'
bpy.ops.wm.open_mainfile(filepath=str(folder / 'clean.blend'), load_ui=False, use_scripts=False)
bpy.context.preferences.filepaths.save_version = 0
for mat in bpy.data.materials:
    if not mat.name.startswith('smooth_concrete_floor') or not mat.use_nodes: continue
    bsdf = next(n for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    for link in bsdf.inputs['Base Color'].links:
        if link.from_node.bl_idname == 'ShaderNodeTexImage' and link.from_node.image.name != 'Clean concrete neutral color':
            link.from_node.image = neutral_concrete(link.from_node.image)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'clean.blend'), compress=True)
export_material_batches(folder / 'clean.raw.glb', lambda obj:False, cell_size=12, extra_uv='UVBake')
