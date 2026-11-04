"""Refresh prepared PBR bindings in an existing editable map without reassembly."""
import bpy,json,sys,hashlib,shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import RECOVERY,MAP_FOLDER
from unity_materials import build_materials
probe='--probe' in sys.argv
source=RECOVERY/'probe.blend' if probe else MAP_FOLDER/'map.blend'
backup=RECOVERY/('probe-before-material-adapters.blend' if probe else 'before-material-adapters.blend')
if not backup.exists():
    shutil.copyfile(source,backup)
    if hashlib.file_digest(source.open('rb'),'sha256').hexdigest()!=hashlib.file_digest(backup.open('rb'),'sha256').hexdigest():raise RuntimeError('Backup mismatch')
bpy.ops.wm.open_mainfile(filepath=str(source))
resources=json.loads((RECOVERY/'browser-resources.json').read_text());old={};counts={}
for entry in resources['materials']:
    name=entry['name'];ordinal=counts.get(name,0);counts[name]=ordinal+1
    expected=name if ordinal==0 else name+'.%03d'%ordinal
    material=next((m for m in bpy.data.materials if m.get('sourceMaterialKey')==entry['key']),None) or bpy.data.materials.get(expected)
    if not material:continue # Blender does not save unused source LOD materials.
    old[material]=entry['key'];material.name='Previous imported '+expected
for image in list(bpy.data.images):
    if image.source=='FILE' and Path(bpy.path.abspath(image.filepath)).exists():
        if image.packed_file:image.unpack(method='USE_ORIGINAL')
        image.reload()
materials,images,_=build_materials(resources,RECOVERY)
slots=0
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    for index,material in enumerate(obj.data.materials):
        if material in old:obj.data.materials[index]=materials[old[material]];slots+=1
for material in old:
    if material.users==0:bpy.data.materials.remove(material)
for image in images.values():image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('PBR_REFRESH',len(materials),slots,flush=True)
