"""Recover each track's authored props, transforms and non-trigger collision."""
import bpy,json,sys,math,re
from pathlib import Path
import xml.etree.ElementTree as ET
from mathutils import Matrix,Vector,Quaternion
import numpy as np
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import ROOT,RECOVERY,PROFILE
from unity_materials import build_materials
from scene_visual_policy import neutral_materials
from runtime_export import export_material_batches
from export_package import three_euler
config=json.loads((RECOVERY/'gate-prefab-config.json').read_text());resources=json.loads((RECOVERY/'browser-track-resources.json').read_text())
records=list(config['records'].values());roots={r['name']:r for r in config['roots']}
B=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));F=Matrix.Diagonal(Vector((-1,1,1,1)))
def key(c,p):return json.dumps(c,separators=(',',':'))+':'+str(p)
def ptr(c,p):return key(resources['collectionDependencies'][json.dumps(c,separators=(',',':'))][str(p['m_FileID'])],p['m_PathID'])
def v(d):return Vector(tuple(d.get('m_'+a,0) for a in 'XYZ'))
def xmlv(e,path,default=(0,0,0)):
    item=e.find(path);return Vector(default) if item is None else Vector(tuple(float(item.findtext(a,'0')) for a in 'xyz'))
mesh_sources={m['key']:m for m in resources['meshes']};reports=[]
audit_only='--audit-collisions' in sys.argv
collision_only='--collision-only' in sys.argv or audit_only
selection=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--tracks=')),None)
selected_tracks={int(value) for value in selection.split(',')} if selection else None
if selected_tracks and any(value<1 for value in selected_tracks):raise ValueError('Track numbers start at one')
for number,path in enumerate(sorted((RECOVERY/'source-tracks').glob('*Track*.xml')),1):
    if selected_tracks is not None and number not in selected_tracks:continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials,images,image=({}, {}, None) if collision_only else build_materials(resources,RECOVERY)
    if not collision_only and PROFILE.get('sceneRepairs',{}).get('neutralBranding'):neutral_materials(materials.values())
    mesh_cache={};created=[];colliders=[];inventory=[];box_frames={}
    def mesh_parts(identity):
        if identity in mesh_cache:return mesh_cache[identity]
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(RECOVERY/mesh_sources[identity]['file']));parts={}
        for obj in set(bpy.data.objects)-before:
            if obj.type=='MESH':
                match=re.search(r'SubMesh_(\d+)',obj.name);index=int(match.group(1)) if match else len(parts)
                # Retain glTF UV conversion; an extra inversion breaks atlases.
                parts[index]=obj.data
            bpy.data.objects.remove(obj,do_unlink=True)
        mesh_cache[identity]=parts;return parts
    track=ET.parse(path).getroot()
    for item in track.find('blueprints'):
        name=item.findtext('itemID');prefab=roots[name];c=prefab['collection'];items=[r for r in records if r['collection']==c]
        transforms={r['data']['m_GameObject']['m_PathID']:r['data'] for r in items if r['type']=='Transform'}
        byid={r['id']:r for r in items};gos={r['id']:r['data'] for r in items if r['type']=='GameObject'}
        filters={r['data']['m_GameObject']['m_PathID']:r for r in items if r['type']=='MeshFilter'}
        def belongs(go):
            if go==prefab['id']:return True
            t=transforms.get(go);p=t['m_Father']['m_PathID'] if t else '0'
            return p!='0' and belongs(byid[p]['data']['m_GameObject']['m_PathID'])
        def active(go):
            if not gos.get(go,{}).get('m_IsActive',True):return False
            if go==prefab['id']:return True
            return active(byid[transforms[go]['m_Father']['m_PathID']]['data']['m_GameObject']['m_PathID'])
        rotation=xmlv(item,'rotation');q=Quaternion((1,0,0,0))
        for axis,angle in [((0,1,0),rotation.y),((1,0,0),rotation.x),((0,0,1),rotation.z)]:q=q@Quaternion(Vector(axis),math.radians(angle))
        base=Matrix.LocRotScale(xmlv(item,'position'),q,xmlv(item,'scale',tuple(v(transforms[prefab['id']]['m_LocalScale']))));cache={prefab['id']:base}
        def world(go):
            if go in cache:return cache[go]
            t=transforms[go];p=byid[t['m_Father']['m_PathID']]['data']['m_GameObject']['m_PathID'];r=t['m_LocalRotation']
            cache[go]=world(p)@Matrix.LocRotScale(v(t['m_LocalPosition']),Quaternion(tuple(r['m_'+a] for a in 'WXYZ')),v(t['m_LocalScale']));return cache[go]
        trigger_renderers={r['data']['m_Structure']['attachedRenderer']['m_PathID'] for r in items if r['type']=='MonoBehaviour' and belongs(r['data']['m_GameObject']['m_PathID']) and r['data'].get('m_Structure',{}).get('attachedRenderer')}
        checkpoint_gos={byid[r]['data']['m_GameObject']['m_PathID'] for r in trigger_renderers}
        lod_selection={}
        for group in items:
            if group['type']!='LODGroup' or not belongs(group['data']['m_GameObject']['m_PathID']):continue
            lods=group['data'].get('m_LODs',[])
            for source_level,lod in enumerate(lods):
                for ref in lod.get('m_Renderers',[]):
                    rid=ref['m_Renderer']['m_PathID'];lod_selection[rid]=[level for level,selected in enumerate([0,min(1,len(lods)-1),len(lods)-1]) if selected==source_level]
        count=0
        for r in items:
            if collision_only or r['type']!='MeshRenderer' or not r['data'].get('m_Enabled') or r['id'] in trigger_renderers:continue
            go=r['data']['m_GameObject']['m_PathID']
            if not belongs(go) or not active(go):continue
            if go in checkpoint_gos or name.startswith(('CheckpointBox','TriggerBox_','SpawnPoint')):continue
            f=filters.get(go)
            if not f:raise RuntimeError('Missing track mesh '+name)
            parts=mesh_parts(ptr(c,f['data']['m_Mesh']));refs=r['data'].get('m_Materials',[])
            for index,data in sorted(parts.items()):
                if not refs:raise RuntimeError('Missing track material '+name)
                material=materials[ptr(c,refs[min(index,len(refs)-1)])]
                mesh=data.copy();mesh.materials.clear();mesh.materials.append(material)
                for poly in mesh.polygons:poly.material_index=0
                color=mesh.color_attributes.new(name='BakedLighting',type='FLOAT_COLOR',domain='CORNER');color.data.foreach_set('color',np.ones(len(color.data)*4,dtype=np.float32))
                obj=bpy.data.objects.new(name+'_'+item.findtext('instanceID')+'_'+str(index),mesh);bpy.context.scene.collection.objects.link(obj);obj.matrix_world=B@F@world(go)@F@B.inverted();obj['source_lods']=lod_selection.get(r['id'],[0,1,2]);created.append(obj);count+=1
        for r in items:
            if r['type'] not in ('BoxCollider','MeshCollider','SphereCollider','CapsuleCollider') or not r['data'].get('m_Enabled',True) or r['data'].get('m_IsTrigger'):continue
            go=r['data']['m_GameObject']['m_PathID']
            if not belongs(go) or not active(go):continue
            if go in checkpoint_gos or name.startswith(('CheckpointBox','TriggerBox_','SpawnPoint')):continue
            m=F@world(go)@F
            if r['type'] in ('SphereCollider','CapsuleCollider'):
                data=r['data'];axis=data['m_Direction'] if r['type']=='CapsuleCollider' else 1
                center=m@(F.to_3x3()@v(data['m_Center']));scales=[abs(n) for n in m.to_scale()]
                radius=max(.005,data['m_Radius']*max(scales[i] for i in range(3) if r['type']=='SphereCollider' or i!=axis))
                half=max(0,data['m_Height']*scales[axis]/2-radius) if r['type']=='CapsuleCollider' else 0
                colliders.append({'type':'capsule','position':list(center),'size':[2*(radius+(half if i==axis else 0)) for i in range(3)],'rotation':three_euler(m.to_quaternion().to_matrix()),'radius':radius,'halfLength':half,'axis':axis,'visible':False})
            elif r['type']=='BoxCollider':
                center=m@(F.to_3x3()@v(r['data']['m_Center']));size=v(r['data']['m_Size']);scale=m.to_scale()
                collider={'position':list(center),'size':[max(.01,abs(size[i]*scale[i])) for i in range(3)],'rotation':three_euler(m.to_quaternion().to_matrix()),'visible':False}
                colliders.append(collider);box_frames[id(collider)]={'prefab':name,'instance':item.findtext('instanceID'),'axes':[list(row) for row in m.to_quaternion().to_matrix()]}
            else:
                triangles=[]
                for mesh in mesh_parts(ptr(c,r['data']['m_Mesh'])).values():
                    mesh.calc_loop_triangles()
                    for tri in mesh.loop_triangles:
                        for i in tri.vertices:triangles.extend(B.inverted()@(B@F@world(go)@F@B.inverted()@mesh.vertices[i].co))
                if triangles:colliders.append({'type':'mesh','vertices':triangles,'visible':False})
        inventory.append({'instance':item.findtext('instanceID'),'prefab':name,'meshes':count})
    # Keep the established contact order; append recovered rounded surfaces.
    colliders=[c for c in colliders if c.get('type')!='capsule']+[c for c in colliders if c.get('type')=='capsule']
    identifier=PROFILE['id']+'-liftoff-'+str(number).zfill(2);destination=ROOT/'content/races'/identifier
    if collision_only:
        race=json.loads((destination/'race.json').read_text());before=race['colliders']
        if len(before)!=len(colliders):raise RuntimeError('Collision repair changed collider count: '+identifier)
        changed=[];repaired=[]
        def camera_euler(angles):return Matrix.Rotation(angles[0],3,'X')@Matrix.Rotation(angles[1],3,'Y')@Matrix.Rotation(angles[2],3,'Z')
        for index,(old,new) in enumerate(zip(before,colliders)):
            if old.get('type')!=new.get('type'):raise RuntimeError('Collider type changed: '+identifier+' / '+str(index))
            for field in ('position','size'):
                if field in old and (len(old[field])!=len(new[field]) or any(abs(a-b)>0.00001 for a,b in zip(old[field],new[field]))):raise RuntimeError('Collider geometry changed: '+identifier+' / '+str(index)+' / '+field)
            # Blender may triangulate an unchanged polygon in a different order.
            # Mesh payloads are outside this repair and remain byte-for-byte old.
            if old.get('type')=='mesh':
                bounds=lambda values:[operation(values[axis::3]) for operation in (min,max) for axis in range(3)]
                if any(abs(a-b)>.0001 for a,b in zip(bounds(old['vertices']),bounds(new['vertices']))):raise RuntimeError('Collider mesh bounds changed: '+identifier+' / '+str(index))
            result=dict(old)
            if id(new) in box_frames:
                source=Matrix(box_frames[id(new)]['axes']);error=camera_euler(old.get('rotation',[0,0,0])).to_quaternion().rotation_difference(source.to_quaternion()).angle
                error=min(error,abs(2*math.pi-error))
                if error>0.0001:
                    changed.append({'index':index,'position':new['position'],'size':new['size'],'oldRotation':old.get('rotation',[0,0,0]),'rotation':new['rotation'],'errorDegrees':math.degrees(error),**box_frames[id(new)]})
                    result['rotation']=new['rotation']
            repaired.append(result)
        repair_report={'id':identifier,'colliders':len(colliders),'changedBoxes':len(changed),'examples':sorted(changed,key=lambda row:max(row['size']),reverse=True)[:8]}
        audit_folder=ROOT/'data/map-repair-20261031';audit_folder.mkdir(parents=True,exist_ok=True)
        (audit_folder/(identifier+'-collider-rotations.json')).write_text(json.dumps(repair_report,indent=2)+'\n')
        if audit_only:
            print('TRACK_COLLISION_AUDIT',json.dumps(repair_report),flush=True)
            if changed:raise RuntimeError('Delivered boxes do not match their source frames: '+identifier)
            continue
        race['colliders']=repaired;(destination/'race.json').write_text(json.dumps(race,indent=2)+'\n')
        inventory_report=json.loads((destination/'track-import.json').read_text());inventory_report['colliders']=len(colliders);(destination/'track-import.json').write_text(json.dumps(inventory_report,indent=2))
        print('TRACK_COLLISION',identifier,len(colliders),'corrected boxes',len(changed),flush=True);continue
    for img in images.values():img.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(destination/'track.blend'))
    target=RECOVERY/(identifier+'-props.glb');runtime=[];cells={};cell_size=16
    for level in range(3):
        root=export_material_batches(target,lambda obj:obj not in created or level not in obj.get('source_lods',[]),keep=True,name='Track LOD'+str(level),cell_size=cell_size,color_layer='BakedLighting',planar_dissolve=True)
        for obj in list(root.children):
            cell=tuple(obj['runtimeCell']);origin=Vector(tuple((n+.5)*cell_size for n in cell));name='TrackCell_'+'_'.join(str(n) for n in cell)+'_LOD'+str(level)
            parent=bpy.data.objects.get(name)
            if not parent:parent=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(parent);runtime.append(parent)
            obj.parent=parent;obj.location-=origin;cells.setdefault(cell,{})[level]=name
        bpy.data.objects.remove(root,do_unlink=True)
    definitions=[]
    for cell,levels in sorted(cells.items()):
        origin=[(n+.5)*cell_size for n in cell];available=sorted(levels)
        definition={'model':'props.glb','modelNode':levels[available[0]],'position':[origin[0],origin[2],-origin[1]],'rotation':[0,0,0],'scale':1}
        if len(available)>1:
            definition['modelLods']=[{'model':'props.glb','modelNode':levels[level],'distance':[0,24,55][index]} for index,level in enumerate(available)];definition['lowLod']=min(1,len(available)-1)
        definitions.append(definition)
    bpy.ops.object.select_all(action='DESELECT')
    for parent in runtime:
        parent.select_set(True)
        for obj in parent.children:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='NAME',export_vertex_color_name='BakedLighting')
    race=json.loads((destination/'race.json').read_text());race['objects']=definitions;race['colliders']=colliders
    for gate in race['gates']:gate['frameSource']='track'
    (destination/'race.json').write_text(json.dumps(race,indent=2)+'\n')
    source=json.loads((destination/'SOURCE.json').read_text());source['trackProps']='Original visible prefab geometry, PBR materials and blueprint transforms. Non-trigger collision retained; source repair/charge logic is not implemented. Checkpoint trigger renderers remain hidden.'
    source['conversion']=source['conversion'].replace('source decorative track props are not included.','source decorative track props are imported separately.')
    source['conversion']=source['conversion'].replace('Visuals use our existing gate renderer;','Authored checkpoint frames are embedded in track props;')
    (destination/'SOURCE.json').write_text(json.dumps(source,indent=2)+'\n')
    report={'id':identifier,'blueprints':len(inventory),'visibleInstances':sum(i['meshes']>0 for i in inventory),'meshes':len(created),'colliders':len(colliders),'inventory':inventory,'lodTriangles':[sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in created if level in obj.get('source_lods',[])) for level in range(3)],'cells':len(definitions)}
    (destination/'track-import.json').write_text(json.dumps(report,indent=2));reports.append({k:v for k,v in report.items() if k!='inventory'})
if not collision_only:
    report_file=RECOVERY/'track-model-report.json'
    if selected_tracks is not None and report_file.exists():
        merged={report['id']:report for report in json.loads(report_file.read_text())}
        merged.update({report['id']:report for report in reports});reports=sorted(merged.values(),key=lambda report:report['id'])
    report_file.write_text(json.dumps(reports,indent=2))
print(json.dumps(reports,indent=2),flush=True)
