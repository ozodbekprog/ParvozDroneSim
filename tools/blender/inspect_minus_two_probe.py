import bpy,json,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'data/minus-two-recovery'
bpy.ops.wm.open_mainfile(filepath=str(root/'probe.blend'))
for index in range(144,148):bpy.data.images.load(str(root/('textures/texture-'+str(index)+'.exr')))
report={'lightmaps':[],'objects':[]}
for image in bpy.data.images:
    if not image.filepath.endswith('.exr'):continue
    values=np.array(image.pixels[:],dtype=np.float32).reshape(-1,4)
    report['lightmaps'].append({'name':image.name,'colorSpace':image.colorspace_settings.name,'rgbPercentiles':np.percentile(values[:,:3], [0,25,50,75,90,99,100],axis=0).tolist()})
for object in bpy.context.scene.objects:
    if object.type!='MESH' or not any(s in object.name.lower() for s in ['pillar','floor','roof']):continue
    mesh=object.data;c=mesh.color_attributes.get('BakedLighting')
    if not c:continue
    values=np.array([v.color[:] for v in c.data])
    report['objects'].append({'name':object.name,'meanLighting':values[:,:3].mean(axis=0).tolist(),
        'uvRanges':[(min(v.uv.x for v in u.data),max(v.uv.x for v in u.data),min(v.uv.y for v in u.data),max(v.uv.y for v in u.data)) for u in mesh.uv_layers]})
(root/'lighting-inspection.json').write_text(json.dumps(report,indent=2))
