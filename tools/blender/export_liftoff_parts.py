"""Export real recovered components, both prop directions, and native socket adapters."""
import bpy,json,sys,re
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import ROOT,RECOVERY
from unity_materials import build_materials
antennas_only='--antennas' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
config=json.loads((RECOVERY/'gate-prefab-config.json').read_text())
resources=json.loads((RECOVERY/'browser-track-resources.json').read_text())
specs=json.loads((RECOVERY/'part-data.json').read_text())
roots={r['name']:r for r in config['roots']};records=list(config['records'].values())
B=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));F=Matrix.Diagonal(Vector((-1,1,1,1)))
materials,images,_=build_materials(resources,RECOVERY);mesh_cache={};prefabs={}
unbound=bpy.data.materials.new('Source runtime-assigned surface');unbound.use_nodes=True
unbound.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.12,.13,.14,1)
def convert(m):return B@F@m@F@B.inverted()
def array(m):
    m=F@m@F
    return [m[r][c] for c in range(4) for r in range(4)]
def v(d):return Vector(tuple(d.get('m_'+a,0) for a in 'XYZ'))
def ptr(c,p):
    collection=resources['collectionDependencies'][json.dumps(c,separators=(',',':'))][str(p['m_FileID'])]
    return json.dumps(collection,separators=(',',':'))+':'+str(p['m_PathID'])
sources={m['key']:m for m in resources['meshes']}
def prefab(name):
    if name in prefabs:return prefabs[name]
    root=roots[name];items=[r for r in records if r['collection']==root['collection']];byid={r['id']:r for r in items}
    transforms={r['data']['m_GameObject']['m_PathID']:r for r in items if r['type']=='Transform'};cache={}
    def world(go):
        if go in cache:return cache[go]
        t=transforms[go]['data'];q=t['m_LocalRotation'];m=Matrix.LocRotScale(v(t['m_LocalPosition']),Quaternion(tuple(q['m_'+a] for a in 'WXYZ')),v(t['m_LocalScale']))
        parent=t['m_Father']['m_PathID']
        if parent!='0':m=world(byid[parent]['data']['m_GameObject']['m_PathID'])@m
        cache[go]=m;return m
    def belongs(go):
        if go==root['id']:return True
        t=transforms.get(go);parent=t['data']['m_Father']['m_PathID'] if t else '0'
        return parent!='0' and belongs(byid[parent]['data']['m_GameObject']['m_PathID'])
    value=(root,items,byid,world,belongs,world(root['id']).inverted())
    prefabs[name]=value;return value
def snap_inverse(name):
    p=prefab(name);points=[r for r in p[1] if r['type']=='GameObject' and r['name']=='SnapPoint' and p[4](r['id'])]
    if len(points)>1:raise RuntimeError('Ambiguous SnapPoint '+name)
    return (p[5]@p[3](points[0]['id'])).inverted() if points else Matrix.Identity(4)
def prop_socket(name):
    p=prefab(name);go=next(r for r in p[1] if r['type']=='GameObject' and r['name']=='PropellerSlot' and p[4](r['id']))
    return p[5]@p[3](go['id'])
def mesh_parts(identity):
    if identity in mesh_cache:return mesh_cache[identity]
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(RECOVERY/sources[identity]['file']));parts={}
    for obj in set(bpy.data.objects)-before:
        if obj.type=='MESH':
            match=re.search(r'SubMesh_(\d+)',obj.name);index=int(match.group(1)) if match else len(parts);parts[index]=obj.data
        bpy.data.objects.remove(obj,do_unlink=True)
    mesh_cache[identity]=parts;return parts
def category(name,data):
    if antennas_only:return 'antenna' if name.startswith('Antenna') else None
    if 'velocityConstant' in data:return 'motors'
    if 'blades' in data:return 'propellers'
    if 'mAh' in data:return 'battery'
    if name.startswith('Camera'):return 'camera'
    return None
parts=[]
for name,record in specs.items():
    data=record['m_Structure'];role=category(name,data)
    if not role:continue
    p=prefab(name);root,items,byid,world,belongs,origin=p
    filters={r['data']['m_GameObject']['m_PathID']:r for r in items if r['type']=='MeshFilter'}
    nodes=[];points=[]
    for clockwise in ([True,False] if role=='propellers' else [False]):
        label='Part_'+name+('_CW' if clockwise else '_CCW' if role=='propellers' else '')
        parent=bpy.data.objects.new(label,None);bpy.context.scene.collection.objects.link(parent);nodes.append(label)
        for r in items:
            if r['type']!='MeshRenderer' or not r['data'].get('m_Enabled'):continue
            go=r['data']['m_GameObject']['m_PathID'];go_name=byid[go]['name']
            if not belongs(go) or 'Blur' in go_name:continue
            if role=='propellers' and ((go_name.endswith('_L') and clockwise) or (go_name.endswith('_R') and not clockwise)):continue
            if go not in filters:raise RuntimeError('Missing authored mesh '+go_name)
            reference=filters[go]['data']['m_Mesh']
            if reference['m_PathID']=='0':continue
            for index,source in mesh_parts(ptr(root['collection'],reference)).items():
                mesh=source.copy();mesh.materials.clear();refs=r['data']['m_Materials'];ref=refs[min(index,len(refs)-1)] if refs else None
                mat=materials[ptr(root['collection'],ref)] if ref and ref['m_PathID']!='0' else unbound;mesh.materials.append(mat)
                for poly in mesh.polygons:poly.material_index=0
                obj=bpy.data.objects.new(label+'_'+go_name+'_'+str(index),mesh);bpy.context.scene.collection.objects.link(obj)
                obj.matrix_world=convert(origin@world(go));matrix=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=matrix
                points.extend([obj.matrix_world@Vector(c) for c in obj.bound_box])
        if not parent.children:raise RuntimeError('Empty authored component '+name)
    size_blender=[max(p[a] for p in points)-min(p[a] for p in points) for a in range(3)]
    parts.append({'sourceId':name,'category':role,'specifications':data,'nodes':nodes,'size':[size_blender[0],size_blender[2],size_blender[1]],'mountMatrixByDrone':{},'propellerMountMatrixByBuild':{}})

import xml.etree.ElementTree as ET
aircraft=[('Luma5_0001','luma-5'),('ArmattanChameleon5inch_0001','armattan-chameleon'),('ArmattanGecko3inch_0001','armattan-gecko'),('DquadAddiction_0001','dquad-addiction')]
stocks={}
for filename,identifier in aircraft:
    if antennas_only:continue
    file=RECOVERY/(filename+'.xml')
    if not file.exists():file=ROOT/'data/liftoff-drone-recovery'/(filename+'.xml')
    xml=ET.parse(file).getroot();blueprint=xml.find('Blueprint')
    stock={role:blueprint.findtext(path) for role,path in [('frame','id'),('camera','camera/id'),('battery','battery/id'),('motors','motorLF/id'),('propellers','motorLF/propeller/id')]}
    stocks[identifier]={'parts':stock,'specifications':{role:specs[name]['m_Structure'] for role,name in stock.items()},'name':xml.findtext('name')}
    for part in parts:
        role=part['category'];name=part['sourceId']
        # Existing aircraft mounts represent the stock part root, not a guessed socket.
        matrix=Matrix.Identity(4) if role=='battery' else snap_inverse(stock[role]).inverted()@snap_inverse(name)
        part['mountMatrixByDrone'][identifier]=array(matrix)
        if role=='propellers':
            original=snap_inverse(stock['motors'])@prop_socket(stock['motors'])@snap_inverse(stock['propellers'])
            for motor in (p for p in parts if p['category']=='motors'):
                modified=snap_inverse(motor['sourceId'])@prop_socket(motor['sourceId'])@snap_inverse(name)
                part['propellerMountMatrixByBuild'][identifier+':'+motor['sourceId']]=array(original.inverted()@modified)
for image in images.values():image.pack()
folder=ROOT/('content/shared-assets/liftoff-antennas' if antennas_only else 'content/shared-assets/liftoff-drone-parts');folder.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'parts.blend'))
original=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in bpy.context.scene.objects if obj.type=='MESH')
report={'parts':parts,'stockAircraft':stocks,'sourceTriangles':original,'lods':[]}
for label,target in [('hangar',60000),('low',18000),('far',5000)]:
    bpy.ops.wm.open_mainfile(filepath=str(folder/'parts.blend'));ratio=min(1,target/original)
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH':continue
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        if ratio<1:
            modifier=obj.modifiers.new('Delivery surface reduction','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.export_scene.gltf(filepath=str(folder/(label+'-source.glb')),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
    report['lods'].append({'name':label,'triangles':sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in bpy.context.scene.objects if obj.type=='MESH')})
(folder/'preparation.json').write_text(json.dumps(report,indent=2)+'\n')
print('AUTHORED_PARTS',len(parts),'SOURCE_TRIANGLES',original,'LOD',json.dumps(report['lods']),flush=True)
