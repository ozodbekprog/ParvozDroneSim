"""Close-up UV review of actual repaired authored objects; never save scene edits."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/flight-uv-evidence-20261015';OUT.mkdir(exist_ok=True)
cases=[('minus-two-demo','TornPosters01'),('hangar-c03-demo','TrafficSignStop01'),('liftoff-arena-demo','BannerArena02')]
report=[]
for id,material in cases:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'content/maps'/id/'map.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render and any(m and m.name==material for m in o.data.materials)]
    obj=min(objects,key=lambda o:len(o.data.polygons))
    # Flat atlas review avoids source scene exposure/specular lighting obscuring
    # the UV correspondence. Copies are temporary and never enter map.blend.
    for index,original in enumerate(obj.data.materials):
        preview=original.copy();obj.data.materials[index]=preview
        nodes=preview.node_tree.nodes;links=preview.node_tree.links
        shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
        base=shader.inputs['Base Color']
        if base.is_linked:links.new(base.links[0].from_socket,emission.inputs['Color'])
        else:emission.inputs['Color'].default_value=base.default_value
        links.new(emission.outputs[0],output.inputs['Surface'])
    for other in bpy.context.scene.objects:
        if other.type in ('MESH','LIGHT'):other.hide_render=other!=obj
    scene=bpy.context.scene
    try:scene.render.engine='BLENDER_EEVEE'
    except TypeError:pass
    scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    try:scene.view_settings.view_transform='Standard'
    except TypeError:pass
    scene.view_settings.exposure=0;scene.view_settings.gamma=1
    scene.world.use_nodes=True
    bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.15,.15,.15,1);bg.inputs['Strength'].default_value=.15
    bounds=[obj.matrix_world@Vector(p) for p in obj.bound_box];center=sum(bounds,Vector())/8
    face=max(obj.data.polygons,key=lambda p:p.area);normal=(obj.matrix_world.to_3x3().inverted().transposed()@face.normal).normalized()
    size=max((max(v[a] for v in bounds)-min(v[a] for v in bounds)) for a in range(3))
    camera=bpy.data.objects.new('UV review camera',bpy.data.cameras.new('UV review'));scene.collection.objects.link(camera);scene.camera=camera
    camera.data.type='ORTHO';camera.data.ortho_scale=max(.2,size*2.25);camera.data.clip_end=10000
    light=bpy.data.objects.new('UV review area',bpy.data.lights.new('UV review area','AREA'));scene.collection.objects.link(light);light.data.energy=3*size*size;light.data.shape='DISK';light.data.size=max(1,size)
    side=normal.cross(Vector((0,0,1))).normalized()
    if side.length<.5:side=Vector((1,0,0))
    for angle in [-.25,0,.25]:
        camera.location=center+(normal+side*angle).normalized()*max(2,size*2)
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        light.location=camera.location;light.rotation_euler=camera.rotation_euler
        file=OUT/(id+'-'+str(round(angle*100))+'.png');scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
    report.append({'map':id,'material':material,'object':obj.name,'review':'Repaired authored primary atlas, three unlit diagnostic views; game Low checked separately'})
(OUT/'sources.json').write_text(json.dumps(report,indent=2))
