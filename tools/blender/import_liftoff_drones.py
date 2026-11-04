"""Assemble authored aircraft using their original prefab mounting transforms."""
import bpy,json,sys,re,math
from pathlib import Path
import xml.etree.ElementTree as ET
from mathutils import Matrix,Vector,Quaternion
import numpy as np
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import ROOT,RECOVERY,PROFILE
from unity_materials import build_materials
config=json.loads((RECOVERY/'gate-prefab-config.json').read_text())
resources=json.loads((RECOVERY/'browser-track-resources.json').read_text())
part_data=json.loads((RECOVERY/'part-data.json').read_text())
roots={r['name']:r for r in config['roots']};records=list(config['records'].values())
B=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));F=Matrix.Diagonal(Vector((-1,1,1,1)))
def v(d):return Vector(tuple(d.get('m_'+a,0) for a in 'XYZ'))
def convert(m):return B@F@m@F@B.inverted()
def key(c,p):return json.dumps(c,separators=(',',':'))+':'+str(p)
def ptr(c,p):return key(resources['collectionDependencies'][json.dumps(c,separators=(',',':'))][str(p['m_FileID'])],p['m_PathID'])
sources={m['key']:m for m in resources['meshes']};reports=[]
for filename,identifier in PROFILE.get('drones',[['Luma5_0001','luma-5'],['ArmattanChameleon5inch_0001','armattan-chameleon']]):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials,images,image=build_materials(resources,RECOVERY);mesh_cache={};created=[];bindings={k:[] for k in ['frame','motors','propellers','camera','battery']}
    unbound=bpy.data.materials.new('Source runtime-assigned surface');unbound.use_nodes=True
    unbound.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.12,.13,.14,1)
    def mesh_parts(identity):
        if identity in mesh_cache:return mesh_cache[identity]
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(RECOVERY/sources[identity]['file']));parts={}
        for obj in set(bpy.data.objects)-before:
            if obj.type=='MESH':
                match=re.search(r'SubMesh_(\d+)',obj.name);index=int(match.group(1)) if match else len(parts)
                # Blender already converts glTF texture coordinates on import.
                # A second V flip breaks the authored atlas and printed labels.
                parts[index]=obj.data
            bpy.data.objects.remove(obj,do_unlink=True)
        mesh_cache[identity]=parts;return parts
    def prefab(name):
        root=roots[name];items=[r for r in records if r['collection']==root['collection']];byid={r['id']:r for r in items}
        transforms={r['data']['m_GameObject']['m_PathID']:r for r in items if r['type']=='Transform'};cache={}
        def world(go):
            if go in cache:return cache[go]
            t=transforms[go]['data'];r=t['m_LocalRotation'];m=Matrix.LocRotScale(v(t['m_LocalPosition']),Quaternion(tuple(r['m_'+a] for a in 'WXYZ')),v(t['m_LocalScale']))
            parent=t['m_Father']['m_PathID']
            if parent!='0':m=world(byid[parent]['data']['m_GameObject']['m_PathID'])@m
            cache[go]=m;return m
        def belongs(go):
            if go==root['id']:return True
            t=transforms.get(go);p=t['data']['m_Father']['m_PathID'] if t else '0'
            return p!='0' and belongs(byid[p]['data']['m_GameObject']['m_PathID'])
        structure=next((r['data']['m_Structure'] for r in items if r['type']=='MonoBehaviour' and r['data'].get('m_Structure',{}).get('id')==name),{})
        origin=world(root['id']).inverted()
        return root,items,byid,world,belongs,structure,origin
    def empty(name,m):
        obj=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(obj);obj.matrix_world=convert(m);return obj
    def add(name,m,role,label,parent=None,clockwise=False):
        root,items,byid,world,belongs,structure,origin=prefab(name);filters={r['data']['m_GameObject']['m_PathID']:r for r in items if r['type']=='MeshFilter'}
        for r in items:
            if r['type']!='MeshRenderer' or not r['data'].get('m_Enabled'):continue
            go=r['data']['m_GameObject']['m_PathID'];go_name=byid[go]['name']
            if not belongs(go) or 'Blur' in go_name:continue
            # Preserve one of the source left/right blade variants.
            if (go_name.endswith('_L') and clockwise) or (go_name.endswith('_R') and not clockwise):continue
            if go not in filters:raise RuntimeError('Missing authored mesh '+go_name)
            if filters[go]['data']['m_Mesh']['m_PathID']=='0':continue
            parts=mesh_parts(ptr(root['collection'],filters[go]['data']['m_Mesh']));refs=r['data']['m_Materials']
            for index,data in sorted(parts.items()):
                mesh=data.copy();mesh.materials.clear();reference=refs[min(index,len(refs)-1)] if refs else None
                material=materials[ptr(root['collection'],reference)] if reference and reference['m_PathID']!='0' else unbound
                mesh.materials.append(material)
                for poly in mesh.polygons:poly.material_index=0
                obj=bpy.data.objects.new(label+'_'+go_name+'_'+str(index),mesh);bpy.context.scene.collection.objects.link(obj);obj.matrix_world=convert(m@origin@world(go));created.append(obj)
                if role in bindings:bindings[role].append(obj.name)
                if parent:
                    matrix=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=matrix
        return structure
    def snap_inverse(name):
        part=prefab(name);points=[r for r in part[1] if r['type']=='GameObject' and r['name']=='SnapPoint' and part[4](r['id'])]
        if len(points)>1:raise RuntimeError('Ambiguous authored SnapPoint '+name)
        return (part[6]@part[3](points[0]['id'])).inverted() if points else Matrix.Identity(4)
    xml=ET.parse(RECOVERY/(filename+'.xml')).getroot();blueprint=xml.find('Blueprint');frame_name=blueprint.findtext('id')
    frame=prefab(frame_name);structure=frame[5];origin=frame[6];world=frame[3];byid=frame[2]
    def mount(field):
        identity=structure[field]['m_PathID'];r=byid.get(identity)
        if not r:
            matches=[r for r in frame[1] if r['type']=='GameObject' and r['name']==field[0].upper()+field[1:] and frame[4](r['id'])]
            if len(matches)!=1:raise RuntimeError('Missing/ambiguous authored slot '+field)
            r=matches[0];identity=r['id']
        go=r['data']['m_GameObject']['m_PathID'] if r['type'] in ('Transform','MonoBehaviour') else identity
        matrix=origin@world(go)
        if field=='batterySlot':
            # PartSlot.Awake reads the direct child SnapPoint, overriding stale
            # serialized snapPosition/Rotation. The part root is placed directly.
            transform=next(r for r in frame[1] if r['type']=='Transform' and r['data']['m_GameObject']['m_PathID']==go)
            children=[byid[p['m_PathID']] for p in transform['data']['m_Children']]
            snap=next((r for r in children if byid[r['data']['m_GameObject']['m_PathID']]['name']=='SnapPoint'),None)
            return matrix@(world(go).inverted()@world(snap['data']['m_GameObject']['m_PathID']) if snap else Matrix.Identity(4))
        config=next((r['data']['m_Structure'] for r in frame[1] if r['type']=='MonoBehaviour' and r['data'].get('m_GameObject',{}).get('m_PathID')==go and 'snapRotation' in r['data'].get('m_Structure',{})),None)
        if config:
            pos=config['snapPosition'];rot=config['snapRotation'];scale=config['snapScale']
            matrix=matrix@Matrix.LocRotScale(Vector(tuple(pos[a] for a in 'xyz')),Quaternion(tuple(rot[a] for a in 'wxyz')),Vector(tuple(scale[a] for a in 'xyz')))
        return matrix
    add(frame_name,Matrix.Identity(4),'frame','Frame')
    mounts={k:[] for k in bindings}
    for role,field in [('camera','cameraSlot'),('battery','batterySlot'),('antenna','antennaSlot'),('actionCam','actionCamSlot')]:
        if role=='actionCam':continue # Optional source accessory needs its runtime-assigned mount skin.
        name=blueprint.findtext(role+'/id')
        if not name:continue
        m=mount(field)@(Matrix.Identity(4) if role=='battery' else snap_inverse(name))
        if role in mounts:mounts[role].append(empty('mount_'+role,m).name)
        start=len(created);add(name,m,role,role.title())
        if role=='battery':
            bpy.context.scene['battery_native_socket_v3']=True
            bpy.context.scene['battery_native_bottom_v2']=True
    motor_positions=[]
    # Imported Unity X is mirrored; order matches the engine's rotor telemetry.
    for i,slot in enumerate(['LF','RF','RB','LB']):
        name=blueprint.findtext('motor'+slot+'/id');m=mount('motor'+slot+'Slot')@snap_inverse(name);motor_positions.append(list((F@m.translation)))
        mounts['motors'].append(empty('mount_motor_'+str(i),m).name);add(name,m,'motors','Motor'+str(i))
        motor=prefab(name);prop_go=next(r for r in motor[1] if r['type']=='GameObject' and r['name']=='PropellerSlot' and motor[4](r['id']))
        prop_name=blueprint.findtext('motor'+slot+'/propeller/id');pm=m@motor[6]@motor[3](prop_go['id'])@snap_inverse(prop_name)
        pivot=empty('prop_'+str(i),pm);mounts['propellers'].append(empty('mount_prop_'+str(i),pm).name)
        add(prop_name,pm,'propellers','Prop'+str(i),pivot,clockwise=i in (0,2))
    bpy.context.scene['liftoff_uv_convention_v2']=True
    for img in images.values():img.pack()
    out=ROOT/'content/drones'/identifier;out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(identifier+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
    triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in created)
    weights=[part_data[frame_name]['m_Structure']['weight']]
    for role in ['camera','battery','antenna']:
        name=blueprint.findtext(role+'/id')
        if name:weights.append(part_data[name]['m_Structure']['weight'])
    for slot in ['LF','RF','LB','RB']:
        for path in ['motor'+slot+'/id','motor'+slot+'/propeller/id']:weights.append(part_data[blueprint.findtext(path)]['m_Structure']['weight'])
    points=[obj.matrix_world@Vector(c) for obj in created for c in obj.bound_box]
    report={'id':identifier,'name':xml.findtext('name'),'meshes':len(created),'triangles':triangles,'mounts':mounts,'partBindings':bindings,'motorBindings':['prop_'+str(i) for i in range(4)],'motorPositions':motor_positions,'mass':sum(weights),'bounds':{'min':[min(p[a] for p in points) for a in range(3)],'max':[max(p[a] for p in points) for a in range(3)]}}
    (out/'preparation.json').write_text(json.dumps(report,indent=2)+'\n');reports.append(report)
(RECOVERY/'drone-import.json').write_text(json.dumps(reports,indent=2)+'\n')
print('DRONES',json.dumps([{k:v for k,v in r.items() if k in ['id','meshes','triangles','mass','bounds']} for r in reports]),flush=True)
