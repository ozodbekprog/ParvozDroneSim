"""Repair primary atlas UVs in existing maps/courses; leave lighting intact."""
import bpy,json,hashlib,shutil,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
from export_package import is_authoring
OUT=ROOT/'data/map-uv-repair-20261015'
ids=['minus-two-demo','hangar-c03-demo','liftoff-arena-demo']
files=[ROOT/'content/maps'/id/'map.blend' for id in ids]
files += [p for p in (ROOT/'content/races').glob('*/track.blend') if any(p.parent.name.startswith(id+'-liftoff-') for id in ids)]
report=json.loads((OUT/'sources.json').read_text()) if (OUT/'sources.json').exists() else []
for file in files:
    if any(r['file']==str(file.relative_to(ROOT)) and r['primaryUvCorners']>0 for r in report):continue
    bpy.ops.wm.open_mainfile(filepath=str(file))
    if bpy.context.scene.get('primary_atlas_uv_corners_v3',0)>0:continue
    backup=OUT/'before'/file.relative_to(ROOT);backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists():shutil.copy2(file,backup)
    if not bpy.context.scene.get('primary_atlas_uv_v3') and hashlib.file_digest(file.open('rb'),'sha256').hexdigest()!=hashlib.file_digest(backup.open('rb'),'sha256').hexdigest():raise RuntimeError('Backup mismatch: '+str(file))
    seen=set();count=0
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or obj.data in seen or not obj.data.uv_layers:continue
        if is_authoring(obj):continue
        seen.add(obj.data);uv=obj.data.uv_layers[0]
        data=np.empty(len(uv.data)*2,dtype=np.float32);uv.data.foreach_get('uv',data)
        data[1::2]=1-data[1::2];uv.data.foreach_set('uv',data);count+=len(uv.data)
    bpy.context.scene['primary_atlas_uv_v3']=True
    if not count:raise RuntimeError('No primary UVs repaired: '+str(file))
    bpy.context.scene['primary_atlas_uv_corners_v3']=count
    bpy.ops.wm.save_as_mainfile(filepath=str(file))
    report=[r for r in report if r['file']!=str(file.relative_to(ROOT))]
    report.append({'file':str(file.relative_to(ROOT)),'primaryUvCorners':count,'backupSha256':hashlib.file_digest(backup.open('rb'),'sha256').hexdigest()})
    (OUT/'sources.json').write_text(json.dumps(report,indent=2))
    print('UV_SOURCE_REPAIRED',file.parent.name,count,flush=True)
(OUT/'sources.json').write_text(json.dumps(report,indent=2))
