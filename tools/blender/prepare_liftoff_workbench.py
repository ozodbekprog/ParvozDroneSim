"""Arrange recovered authored props and existing Luma spare parts; no new meshes."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
folder=ROOT/'content/shared-assets/liftoff-workbench'
bpy.ops.wm.open_mainfile(filepath=str(folder/'map.blend'))
props=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
table=next(o for o in props if o.name.startswith('PicnicTable01_'))
tables=[o for o in props if o.name.startswith('PicnicTable01_')]
def vertices(objects):return [o.matrix_world@v.co for o in objects for v in o.data.vertices]
points=vertices(tables)
origin=Vector(((min(p.x for p in points)+max(p.x for p in points))/2,(min(p.y for p in points)+max(p.y for p in points))/2,min(p.z for p in points)))
for o in props:o.location-=origin
bpy.context.view_layer.update()
def tabletop(x,y):
    heights=[]
    for table in tables:
        inverse=table.matrix_world.inverted();origin=inverse@Vector((x,y,10));direction=inverse.to_3x3()@Vector((0,0,-1))
        for dx,dy in [(0,0),(.02,0),(-.02,0),(0,.02),(0,-.02),(.04,0),(-.04,0)]:
            origin=inverse@Vector((x+dx,y+dy,10))
            hit,point,normal,index=table.ray_cast(origin,direction.normalized())
            if hit:heights.append((table.matrix_world@point).z)
    if not heights:raise RuntimeError('Prop anchor misses the authored tabletop: '+str((x,y)))
    return max(heights)
top=tabletop(0,0)
print('TABLE_SURFACE',top,[(o.name,[[min(p[a] for p in vertices([o])),max(p[a] for p in vertices([o]))] for a in range(3)]) for o in tables],flush=True)
contacts=[]
if '--inspect' in sys.argv:
    for y in [-.6,-.4,-.2,0,.2,.4,.6]:
        row=[]
        for x in [-.8,-.6,-.4,-.2,0,.2,.4,.6,.8]:
            try:row.append(round(tabletop(x,y),3))
            except RuntimeError:row.append(None)
        print('SURFACE_GRID',y,row,flush=True)
    sys.exit(0)
def place(group,x,y,label):
    bpy.context.view_layer.update();points=vertices(group)
    center=Vector(((min(p.x for p in points)+max(p.x for p in points))/2,(min(p.y for p in points)+max(p.y for p in points))/2,min(p.z for p in points)))
    surface=tabletop(x,y)
    for o in group:
        matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix;o.location+=Vector((x,y,surface))-center
    bpy.context.view_layer.update();bottom=min(p.z for p in vertices(group));contacts.append({'part':label,'bottom':bottom,'surface':surface,'gap':bottom-surface})
for prefix,anchor in [('DroneCharger01_',(.18,.6)),('SolderingIron01_',(.18,-.65))]:
    group=[o for o in props if o.name.startswith(prefix)]
    place(group,*anchor,prefix)
# Imported table, charger and soldering iron keep their original proportions.
existing=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'content/drones/luma-5/model.glb'))
imported=set(bpy.data.objects)-existing
bindings=json.loads((ROOT/'content/drones/luma-5/drone.json').read_text())['partBindings']
spares=[('battery',bindings['battery'],(-.20,-.45,top)),('motors',bindings['motors'][:2],(-.20,.45,top)),('propellers',bindings['propellers'][:1],(-.20,-.85,top))]
kept=set()
for category,names,anchor in spares:
    objects=[o for o in imported if o.type=='MESH' and o.name in names]
    if not objects:raise RuntimeError('Missing original spare '+category)
    bpy.context.view_layer.update()
    place(objects,*anchor[:2],category)
    for o in objects:
        o.name='Spare '+category+' '+o.name;kept.add(o)
for o in imported-kept:bpy.data.objects.remove(o,do_unlink=True)
for o in list(bpy.context.scene.objects):
    if o not in props and o not in kept:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update();models=props+list(kept)
points=[o.matrix_world@Vector(p) for o in models for p in o.bound_box]
info={'tabletopHeight':top,'bounds':{'min':[min(p.x for p in points),min(p.z for p in points),-max(p.y for p in points)],'max':[max(p.x for p in points),max(p.z for p in points),-min(p.y for p in points)]},'objects':len(models),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in models)}
info['contacts']=contacts
(folder/'workbench.json').write_text(json.dumps(info,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'workbench.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(folder/'model.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
print('ORIGINAL_WORKBENCH',json.dumps(info),flush=True)
