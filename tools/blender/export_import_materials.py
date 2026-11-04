"""Export prepared PBR bindings only; temporary triangles never enter delivery."""
import bpy,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import RECOVERY,MAP_FOLDER
bpy.ops.wm.open_mainfile(filepath=str(MAP_FOLDER/'map.blend'))
materials=[m for m in bpy.data.materials if m.get('sourceMaterialKey')]
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
for i,mat in enumerate(materials):
    mesh=bpy.data.meshes.new('TEMP material sample');mesh.from_pydata([(i*2,0,0),(i*2+1,0,0),(i*2,1,0)],[],[(0,1,2)])
    uv=mesh.uv_layers.new();uv.data.foreach_set('uv',[0,0,1,0,0,1])
    colors=mesh.color_attributes.new(name='BakedLighting',type='FLOAT_COLOR',domain='CORNER');colors.data.foreach_set('color',[1,1,1,1]*3)
    mesh.materials.append(mat);o=bpy.data.objects.new('TEMP material sample',mesh);bpy.context.scene.collection.objects.link(o);o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(RECOVERY/'materials-only.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
print('MATERIAL_CATALOG',len(materials),flush=True)
