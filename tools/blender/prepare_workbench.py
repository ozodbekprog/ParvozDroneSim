"""Arrange complete CC0 authored models in Blender; no generated stand-ins."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'content/shared-assets/workbench';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
report=[]
def append(id):
    source=ROOT/'content/source-assets'/('polyhaven-'+id)/(id+'.blend')
    before=set(bpy.data.objects)
    with bpy.data.libraries.load(str(source),link=False) as (data,loaded):
        loaded.objects=[name for name in data.objects]
    objects=[]
    for obj in loaded.objects:
        if obj and obj.type=='MESH':
            bpy.context.scene.collection.objects.link(obj);objects.append(obj)
    # Authored object coordinates are kept relative to the complete assembly.
    bpy.context.view_layer.update()
    matrices={obj:obj.matrix_world.copy() for obj in objects}
    for obj in objects:
        obj.parent=None;obj.matrix_world=matrices[obj];obj.animation_data_clear()
    bpy.context.view_layer.update()
    points=[obj.matrix_world@Vector(c) for obj in objects for c in obj.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return objects,lo,hi
def place(id,width,position,angle=0,longest=False):
    objects,lo,hi=append(id);factor=width/(max(hi-lo) if longest else hi.x-lo.x)
    center=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z))
    from mathutils import Matrix
    matrix=Matrix.Translation(Vector(position))@Matrix.Rotation(angle,4,'Z')@Matrix.Scale(factor,4)@Matrix.Translation(-center)
    for obj in objects:obj.matrix_world=matrix@obj.matrix_world
    report.append({'source':id,'meshes':len(objects),'sourceSize':list(hi-lo),'scale':factor})
    return (hi.z-lo.z)*factor
top=place('metal_office_desk',2.0,(0,0,0))
place('screwdrivers_02',.24,(-.36,-.12,top+.003),-.28,longest=True)
place('bench_vice_01',.28,(.4,.1,top+.003),math.pi/2,longest=True)
for img in bpy.data.images:
    if img.source=='FILE':
        # Libraries carry absolute source paths after loading; preserve source
        # basenames and resolve them to their verified downloaded textures.
        if not Path(bpy.path.abspath(img.filepath)).exists():
            matches=list((ROOT/'content/source-assets').glob('polyhaven-*/textures/'+Path(img.filepath).name))
            if len(matches)!=1:raise RuntimeError('Missing authored texture '+img.filepath)
            img.filepath=str(matches[0])
        img.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'workbench.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
(OUT/'workbench.json').write_text(json.dumps({'top':top,'position':[0,top+.005,0],'sources':report},indent=2)+'\n')
print('WORKBENCH',json.dumps({'top':top,'sources':report}),flush=True)
