"""Delivery-only spatial LOD chunks sharing textures in a single GLB."""
import bpy, math,json
from mathutils import Vector
from runtime_export import export_material_batches

def export_site(out,collection):
    original=[o for o in collection.objects if o.type=='MESH' and not o.hide_render]
    ground=set(o for o in original if o.get('site_ground') or o.name.startswith('Courtyard concrete'))
    cells={}
    for obj in original:
        if obj in ground:continue
        points=[obj.matrix_world@Vector(v) for v in obj.bound_box];centre=sum(points,Vector())/8
        cell=(math.floor(centre.x/32),math.floor(centre.y/32))
        cells.setdefault(cell,set()).add(obj)
    roots=[];objects=[];levels=[]
    root=export_material_batches(None,lambda o:o not in ground,extra_uv='UVBake',keep=True,name='SiteGround')
    roots.append(root)
    for index,((cx,cy),members) in enumerate(sorted(cells.items())):
        centre=((cx+.5)*32,(cy+.5)*32,0);names=[];counts=[]
        for tier,ratio in enumerate([1,.28,.055]):
            mods=[]
            if ratio<1:
                for obj in members:
                    mod=obj.modifiers.new('Runtime spatial LOD','DECIMATE');mod.ratio=ratio;mods.append((obj,mod))
            name=f'SiteChunk_{index:02d}_LOD{tier}'
            repeat=None if tier==2 else lambda o:o.name.startswith(('wall_','window_','crown_','cornice','modular_industrial_pipes','barrel_03'))
            root=export_material_batches(None,lambda o:o not in members,extra_uv='UVBake',instanced=repeat,keep=True,name=name,origin=centre,vertex_colors=tier==2)
            count=0
            for child in root.children:
                child.data.calc_loop_triangles();count+=len(child.data.loop_triangles)
            counts.append(count);roots.append(root);names.append(name)
            for obj,mod in mods:obj.modifiers.remove(mod)
        objects.append({'model':'model.glb','modelNode':names[0],'modelLods':[{'model':'model.glb','modelNode':n,'distance':d} for n,d in zip(names,[0,38,72])],'lowLod':1,'position':[centre[0],0,-centre[1]],'rotation':[0,0,0],'scale':1})
        levels.append({'cell':[cx,cy],'models':names,'triangles':counts})
        print('SITE_CHUNK',index,'objects',len(members),'triangles',counts,flush=True)
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for child in root.children:child.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/'model.raw.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=False,export_cameras=False,export_lights=False)
    (out/'site-chunks.json').write_text(json.dumps({'cellMetres':32,'chunks':levels,'oneSharedAsset':True,'farColor':'Baked authored albedo into vertex colors; original silhouettes retained'},indent=2))
    return {'model':'model.glb','modelNode':'SiteGround','objects':objects}
