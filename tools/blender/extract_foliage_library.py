"""Append only reviewed materials, avoiding another full map load/export.
blender --background --factory-startup --python this.py -- candidate.blend report.json metadata.json output.blend
"""
import bpy,json,pathlib,sys
source,report,metadata,output=map(pathlib.Path,sys.argv[sys.argv.index('--')+1:])
names=json.loads(report.read_text(encoding='utf-8'))['materials']
keys={m['key'] for m in json.loads(metadata.read_text(encoding='utf-8'))['materials']}
with bpy.data.libraries.load(str(source.resolve()),link=False) as (available,destination):
    if not set(names)<=set(available.materials):raise RuntimeError('Reviewed material names do not match the editable candidate')
    destination.materials=names
materials=set(destination.materials)
if {m.get('sourceMaterialKey') for m in materials}!=keys:raise RuntimeError('Native source bindings differ')
if any(not m.get('foliagePBR') for m in materials):raise RuntimeError('Material recovery is not applied')
bpy.data.libraries.write(str(output.resolve()),materials,path_remap='RELATIVE',fake_user=True,compress=True)
print('EDITABLE_FOLIAGE_LIBRARY',json.dumps({'file':str(output),'materials':len(materials)}),flush=True)
