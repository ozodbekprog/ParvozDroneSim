"""Native Blender authoring and delivery rebuild.

blender --background --python tools/blender/rebuild_harborworks.py -- --source MAP_BACKUP --races RACE_BACKUP
Source must be an untouched pre-expansion Harborworks package. Canonical output is
content/maps/harborworks; route JSON belongs to the integration pass, not this tool.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

args=argparse.ArgumentParser();args.add_argument('--source',required=True);args.add_argument('--races',required=True)
opt=args.parse_args(sys.argv[sys.argv.index('--')+1:])
ROOT=Path(__file__).resolve().parents[2];SRC=Path(opt.source);OUT=ROOT/'content/maps/harborworks'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
core=collection('01 Original Harborworks — expanded 2x plan, 1.35x height')
terrain=collection('02 Ground, harbour basin and seawalls')
workshops=collection('03 West fabrication workshops')
logistics=collection('04 North logistics apron')
terminal=collection('05 East freight terminal')
south=collection('06 South refinery and administration')
details=collection('07 Streets, fixtures and navigation landmarks')
markers=collection('90 Authoring route markers — excluded from GLB')
lighting=collection('91 Preview camera and lighting — excluded from GLB')
bpy.ops.import_scene.gltf(filepath=str(SRC/'model.glb'))
transform=Matrix.Diagonal((2.,2.,1.35,1.))
for obj in list(scene.objects):
    if obj.type!='MESH':continue
    obj.matrix_world=transform@obj.matrix_world
    for c in list(obj.users_collection):c.objects.unlink(obj)
    core.objects.link(obj)
    obj['source']='Original Harborworks mesh, spatially expanded in Blender'
colliders=json.loads((SRC/'collision.json').read_text())
for c in colliders:
    for key in ['position','size']:c[key]=[round(v*s,6) for v,s in zip(c[key],[2,1.35,2])]
materials={m.name:m for m in bpy.data.materials}
def mat(name,color,rough=.75,metal=.0):
    if name in materials:return materials[name]
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    materials[name]=m;return m
concrete=mat('Expansion concrete',(.30,.34,.34),.93)
asphalt=mat('Expansion asphalt',(.075,.095,.11),.96)
steel=mat('Expansion blue steel',(.065,.12,.16),.48,.65)
ivory=mat('Expansion wall ivory',(.59,.62,.57),.9)
teal=mat('Expansion workshop teal',(.06,.3,.32),.65,.35)
yellow=mat('Expansion safety ochre',(.88,.56,.09),.62,.2)
rust=mat('Expansion oxide red',(.46,.14,.07),.72,.35)
glass=mat('Expansion blue glazing',(.14,.34,.41),.27,.5)
sea=mat('Expansion harbour water',(.025,.12,.16),.28,.3)
wood=mat('Expansion crate timber',(.32,.20,.105),.95)
paint=mat('Expansion road paint',(.75,.77,.65),.8)
green=mat('Expansion planted verge',(.11,.22,.15),1)
lamp=mat('Expansion warm light',(.95,.8,.42),.45)
lamp.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.72,.32,1)
lamp.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.7
def cv(p):return (p[0],-p[2],p[1])
def mesh_obj(name,v,f,m,c):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([cv(p) for p in v],[],f);mesh.materials.append(m);mesh.update()
    ob=bpy.data.objects.new(name,mesh);c.objects.link(ob);return ob
def box(name,p,s,m,c=details,solid=False):
    v=[[p[j]+s[j]*q[j]/2 for j in range(3)] for q in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    ob=mesh_obj(name,v,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)],m,c)
    if solid:colliders.append(dict(position=list(p),size=list(s)))
    return ob
def beam(name,a,b,r,m,c=details,n=10,solid=False):
    aa=Vector(a);bb=Vector(b);d=(bb-aa).normalized();u=d.cross(Vector((0,1,0)) if abs(d.y)<.9 else Vector((1,0,0))).normalized();v=d.cross(u)
    vertices=[tuple(p+r*(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))) for p in [aa,bb] for i in range(n)]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    ob=mesh_obj(name,vertices,faces,m,c)
    if solid:colliders.append(dict(position=list((aa+bb)/2),size=[max(.01,abs(bb[j]-aa[j])+2*r*math.sqrt(max(0,1-d[j]**2))) for j in range(3)]))
    return ob
def tank(name,x,z,r,h,c=south):
    beam(name,(x,0,z),(x,h,z),r,ivory,c,24,True)
    for y in [1,h*.45,h-.5]:beam(name+' shell band',(x,y,z),(x,y+.16,z),r+.12,steel,c,24)
    beam(name+' top cap',(x,h,z),(x,h+.35,z),r*.92,steel,c,24)
    for zz in [-.5,.5]:beam(name+' ladder stile',(x+r+.4,.3,z+zz),(x+r+.4,h+1,z+zz),.07,steel,c)
    for y in range(1,int(h)+1):beam(name+' ladder rung',(x+r+.4,y,z-.5),(x+r+.4,y,z+.5),.055,yellow,c)
def crate(x,z,y=0,c=logistics):
    box('Timber transit crate',(x,y+1.5,z),(3,3,3),wood,c,True)
    for dx in [-1.3,1.3]:box('Crate steel strap',(x+dx,y+1.5,z),( .09,3.04,3.04),steel,c)
def container(x,z,col,c=logistics,y=0):
    box('Freight container shell',(x,y+2.6,z),(6,5.2,20),col,c,True)
    for dz in range(-9,10,2):
        for dx in [-3.04,3.04]:box('Container corrugation',(x+dx,y+2.6,z+dz),(.08,4.8,.16),col,c)
    for dx in [-1.4,1.4]:
        box('Container door',(x+dx,y+2.6,z+10.06),(2.7,4.9,.1),col,c)
        beam('Door locking rod',(x+dx,y+.4,z+10.2),(x+dx,y+4.8,z+10.2),.06,steel,c)
def shed(name,x,z,w=46,l=62,c=workshops):
    # Open ends and a broad unobstructed internal flight aisle.
    for dx in [-w/2,w/2]:
        box(name+' side wall',(x+dx,9,z),(.6,18,l),teal,c,True)
        for dz in range(-int(l/2)+5,int(l/2),10):
            box(name+' high window',(x+dx+( .32 if dx>0 else -.32),12,z+dz),(.06,3,6),glass,c)
            box(name+' wall rib',(x+dx,9,z+dz),(.9,18,.18),steel,c)
    for dz in [-l/2,l/2]:
        for dx in [-w/2+4,w/2-4]:box(name+' portal jamb',(x+dx,9,z+dz),(8,18,.8),ivory,c,True)
        box(name+' door header',(x,17,z+dz),(w,2,.8),yellow,c,True)
    box(name+' flat roof',(x,18.25,z),(w+1,.5,l+1),steel,c,True)
    for dz in range(-int(l/2)+4,int(l/2),10):
        box(name+' roof beam',(x,16.7,z+dz),(w,.4,.4),steel,c,True)
        for dx in [-w/2+5,w/2-5]:
            box(name+' workbench',(x+dx,1.4,z+dz),(5,2.8,6),steel,c,True)
            box(name+' bench top',(x+dx,2.9,z+dz),(5.2,.2,6.2),wood,c)
            box(name+' task light',(x+dx,15.8,z+dz),(4,.1,.4),lamp,c)
    for dx in [-w/2+4,w/2-4]:box(name+' HVAC',(x+dx,19.5,z),(4,2,7),concrete,c,True)
def crane(name,x,z,c=terminal):
    for dx in [-17,17]:
        box(name+' portal leg',(x+dx,15,z),(1.4,30,1.8),yellow,c,True)
        box(name+' bogie',(x+dx,1,z),(4,2,8),steel,c,True)
        beam(name+' brace',(x+dx,3,z-3),(x+dx,24,z),.22,yellow,c)
    box(name+' crosshead',(x+7,31,z),(57,1.8,2.4),yellow,c,True)
    for xx in range(-20,33,5):beam(name+' lattice',(x+xx,30,z-1.2),(x+xx+4,32,z-1.2),.13,steel,c)
    box(name+' cab',(x+28,28,z),(5,4,4),yellow,c,True)
    box(name+' cab glazing',(x+28,28.5,z+2.05),(4,2,.08),glass,c)
    beam(name+' hoist',(x+32,30,z),(x+32,10,z),.06,steel,c)
def office(name,x,z,c=south):
    box(name+' building',(x,8,z),(38,16,30),ivory,c,True)
    box(name+' roof',(x,16.4,z),(40,.8,32),steel,c,True)
    for y in [4,10]:
        for dx in range(-14,15,7):
            for dz in [-15.04,15.04]:box(name+' window',(x+dx,y,z+dz),(4,3,.08),glass,c)
    for dx in [-12,10]:box(name+' air handler',(x+dx,18,z),(6,2.5,6),concrete,c,True)

# 860 x 840 m coastal estate, with the original transformed circuit in the centre.
box('West estate foundation',(-305,-2,0),(230,4,840),concrete,terrain,True)
for z in [-295,295]:box('Estate apron extension',(-40,-2,z),(300,4,250),concrete,terrain,True)
box('East terminal island',(350,-2,0),(180,4,740),concrete,terrain,True)
box('Harbour channel',(225,-1.7,0),(230,.3,840),sea,terrain)
box('West circulation avenue',(-208,.045,0),(32,.09,810),asphalt,terrain)
for z in [-196,196]:box('Cross-estate road',(-155,.06,z),(525,.09,30),asphalt,terrain)
for x in [-208,350]:
    for z in range(-390,400,18):box('Road centre dash',(x,.11,z),(.28,.035,8),paint,details)
for z in [-310,310]:
    box('East terminal apron',(350,.045,z),(170,.09,78),asphalt,terrain)
    box('Extended berth pier',(182,-.1,z),(146,1,24),concrete,terrain,True)
    for x in range(120,250,16):
        beam('Pier support',(x,-8,z),(x,-.6,z),.7,concrete,terrain,12)
        box('Pier edge marker',(x,.43,z-11), (4,.08,.4),yellow,details)
for z in [-330,330]:box('Wide road bridge',(227,3,z),(74,2,24),concrete,terrain,True)
# Keep the original 340m central quay unchanged; extensions begin beyond it.
for z in [-290,290]:
    box('Extended quay edge',(109,.2,z),(2,2.5,230),concrete,terrain,True)
    for zz in range(int(z-105),int(z+110),14):
        beam('Quay bollard',(106,.2,zz),(106,1.2,zz),.3,steel,details,12)
        box('Quay fender',(110.2,-.1,zz),(.5,2,1.4),steel,details)
        box('Quay safety stripe',(108,1.5,zz),(1,.1,6),yellow,details)
for x,z in [(-330,-290),(-270,-290),(-330,20),(-275,20),(-330,290)]:shed('Fabrication hall',x,z)
for x,z in [(-335,-115),(-275,135),(-270,315)]:office('Harbour operations',x,z)
for x in [-135,-100,-65,-30,5,40]:
    for z in [-310,-275]:
        container(x,z,[teal,rust,steel][(int(x)+int(z))%3])
        if x in [-135,-65,5]:container(x,z,steel,y=5.2)
for x,z in [(-140,270),(-103,270),(-65,270),(-140,320),(-103,320)]:tank('South storage',x,z,10,23 if z==270 else 17)
for x,z in [(70,-265),(70,250),(305,-155),(305,125)]:crane('Freight gantry',x,z)
for x in [310,350,395]:
    for z in [-245,-210,215,250]:container(x,z,teal if x==350 else rust,terminal)
shed('East maintenance hangar',378,-55,52,74,terminal)
office('Terminal customs',385,70,terminal)
for x,z in [(-365,200),(-170,360),(395,340)]:
    beam('Navigation tower',(x,0,z),(x,38,z),2.8,ivory,details,20,True)
    for y in [8,18,28]:beam('Tower ochre band',(x,y,z),(x,y+3,z),2.85,yellow,details,20)
    box('Tower observation gallery',(x,37,z),(9,4,9),steel,details,True)
    box('Tower illuminated cap',(x,39.3,z),(10,.5,10),lamp,details)
    beam('Tower antenna',(x,40,z),(x,49,z),.16,steel,details)
for x in [-391,-238,80,425]:
    for z in range(-360,370,80):
        beam('Estate lighting mast',(x,0,z),(x,18,z),.18,steel,details,10,True)
        box('Estate light arm',(x+2,18,z),(5,.2,.3),steel,details)
        box('Estate luminaire',(x+4,17.8,z),(1.6,.25,.8),lamp,details)
for x,z in [(-345,-225),(-290,-222),(-333,80),(-350,345),(-24,-240),(370,160),(395,-115)]:
    for dx in [0,4]:
        for dz in [0,4]:crate(x+dx,z+dz,0,details)
for x,z in [(-385,-40),(-386,125),(-390,330),(-175,390)]:
    box('Planted buffer',(x,.3,z),(12,.6,30),green,details)
    for dz in [-10,0,10]:
        beam('Young tree trunk',(x,.5,z+dz),(x,5,z+dz),.2,wood,details)
        beam('Stylized tree crown',(x,4,z+dz),(x,9,z+dz),2.6,green,details,8)
for z in [-380,380]:
    for x in range(-380,70,30):box('Apron parking line',(x,.08,z),( .15,.03,18),paint,details)

# Native route markers are authoring-only empties and never selected for export.
for rp in sorted(Path(opt.races).glob('harborworks-*/race.json')):
    track=json.loads(rp.read_text());tc=bpy.data.collections.new('Route '+track['id']);markers.children.link(tc)
    for i,g in enumerate(track['gates']):
        ob=bpy.data.objects.new('Authoring checkpoint %s %02d'%(track['id'],i+1),None);tc.objects.link(ob)
        ob.location=cv([v*s for v,s in zip(g['position'],[2,1.35,2])]);ob.empty_display_type='CUBE';ob.empty_display_size=2
        ob['track']=track['id'];ob['order']=i;ob['yaw']=g['yaw'];ob['width']=g['width']*2;ob['height']=g['height']*1.35;ob['authoring_only']=True
markers.hide_render=True

# Real Blender orthographic thumbnail, with shadows and ambient occlusion.
world=bpy.data.worlds.new('Harbor overcast');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.43,.57,.65,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
ld=bpy.data.lights.new('Late afternoon sun','SUN');ld.energy=3;ld.angle=math.radians(18)
sunob=bpy.data.objects.new('Late afternoon sun',ld);lighting.objects.link(sunob);sunob.rotation_euler=(.45,-.5,-.45)
camd=bpy.data.cameras.new('Harborworks preview');cam=bpy.data.objects.new('Harborworks preview',camd);lighting.objects.link(cam)
cam.location=(850,-1050,1000);target=Vector((10,0,0));cam.rotation_euler=(target-Vector(cam.location)).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.clip_end=5000;camd.ortho_scale=1300;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=1280;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'thumbnail.png')
scene['map_id']='harborworks';scene['world_axis']='Blender Z up; GLB runtime Y up';scene['original_plan_scale']=2.;scene['original_height_scale']=1.35
scene['runtime_export']='Only mesh geometry; route empties and preview lighting excluded'
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'map.blend'))

# Consolidate duplicate meshes into one material-indexed object only for delivery.
# The saved .blend retains modular named objects and all collections.
copies=[]
for ob in list(scene.objects):
    if ob.type=='MESH':
        dup=ob.copy();dup.data=ob.data.copy();scene.collection.objects.link(dup);copies.append(dup)
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();joined=bpy.context.object;joined.name='Harborworks runtime material batches'
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',use_selection=True,export_extras=False,export_cameras=False,export_lights=False,export_yup=True)
bpy.data.objects.remove(joined,do_unlink=True)
(OUT/'collision.json').write_text(json.dumps(colliders,separators=(',',':'))+'\n')
definition=json.loads((SRC/'map.json').read_text());definition.update(theme='custom',environment='harborworks',atmosphereIdentity='harborworks',fogDensity=.0014,bounds={'min':[-420,-12,-420],'max':[440,52,420]},groundPlane=False,model='model.glb',collisionFile='collision.json',colliders=[])
(OUT/'map.json').write_text(json.dumps(definition,indent=2)+'\n')
metadata=dict(map='harborworks',tool='Blender',version=bpy.app.version_string,sourceFile='map.blend',generator='tools/blender/rebuild_harborworks.py',runtime='model.glb',originalScale=[2,1.35,2],boundsXZ=[-420,440,-420,420],collisionBoxes=len(colliders),markerExport=False,license='Original project-authored geometry; no external assets',detail='medium; modular industrial structures and broad flight corridors')
(OUT/'authoring.json').write_text(json.dumps(metadata,indent=2)+'\n')
bpy.ops.render.render(write_still=True)
print('HARBORWORKS_NATIVE_DONE '+json.dumps(metadata))
