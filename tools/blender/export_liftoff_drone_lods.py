"""Optimize the preserved authored Blender source into three delivery levels."""
import bpy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for identifier in requested or ['luma-5','armattan-chameleon']:
    if identifier not in ['luma-5','armattan-chameleon','armattan-gecko','dquad-addiction']:raise ValueError('Unknown authored aircraft')
    out=ROOT/'content/drones'/identifier;source=out/(identifier+'.blend');report=[]
    original=json.loads((out/'preparation.json').read_text())['triangles']
    for name,target in [('hangar',38000),('low',11000),('far',2600)]:
        bpy.ops.wm.open_mainfile(filepath=str(source));ratio=min(1,target/original)
        for obj in list(bpy.context.scene.objects):
            if obj.type!='MESH':continue
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
            modifier=obj.modifiers.new('Delivery surface reduction','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        count=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in bpy.context.scene.objects if obj.type=='MESH')
        bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
        report.append({'name':name,'triangles':count})
    (out/'lod-report.json').write_text(json.dumps(report,indent=2)+'\n');print('LOD',identifier,json.dumps(report),flush=True)
