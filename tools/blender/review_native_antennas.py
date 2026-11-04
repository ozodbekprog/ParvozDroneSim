"""Offline visual check of preserved aircraft art + native antenna slot (no source writes)."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
args=sys.argv[sys.argv.index('--')+1:];identifier,source_id=args[:2]
folder=ROOT/'content/drones'/identifier
bpy.ops.wm.open_mainfile(filepath=str(folder/(identifier+'.blend')))
config=json.loads((folder/'drone.json').read_text())
for obj in list(bpy.data.objects):
    if obj.name.startswith('Antenna_') or obj.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(obj,do_unlink=True)
if source_id!='AntennaBlank':
    prefix='Part_'+source_id
    with bpy.data.libraries.load(str(ROOT/'content/shared-assets/liftoff-antennas/parts.blend'),link=False) as (src,dst):
        dst.objects=[name for name in src.objects if name==prefix or name.startswith(prefix+'_')]
    for obj in dst.objects:
        if obj and not obj.users_collection:bpy.context.scene.collection.objects.link(obj)
    parent=next(obj for obj in dst.objects if obj.name==prefix)
    m=config['customization']['slots']['antenna'][0]['matrix']
    matrix=Matrix(tuple(tuple(m[col*4+row] for col in range(4)) for row in range(4)))
    basis=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
    parent.matrix_world=basis@matrix@basis.inverted()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=900;scene.render.resolution_y=700;scene.render.resolution_percentage=100
if scene.world is None:scene.world=bpy.data.worlds.new('Review world')
scene.world.color=(.2,.2,.2)
for location,power,size in [((.4,-.5,1),70,.8),((-.6,.2,.5),40,.6)]:
    data=bpy.data.lights.new('Review softbox','AREA');data.energy=power;data.shape='DISK';data.size=size
    light=bpy.data.objects.new('Review softbox',data);scene.collection.objects.link(light);light.location=location
    light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(camera);scene.camera=camera
data.lens=58
out=ROOT/'data/native-antenna-review';out.mkdir(exist_ok=True)
for label,location in [('rear',(.38,.5,.3)),('front',(-.38,-.5,.25))]:
    camera.location=location;camera.rotation_euler=(Vector((0,0,.03))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(identifier+'-'+source_id+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
