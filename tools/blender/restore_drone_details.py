"""Restore preserved procedural wiring and authored removable camera accessories.

No game extraction, map export, or replacement drone assembly occurs here. Exact
source Bezier paths, camera meshes, UVs and native transforms are read from the
already preserved recovery cache. The independent detail library is editable in
Blender; electrical leads remain editable Bezier curves in its source file.
"""
import bpy, json, sys, math, shutil, tempfile, os
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
sys.path.insert(0, str(Path(__file__).parent))
from unity_materials import build_materials

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'data/liftoff-new-drone-recovery'
OUT = ROOT / 'content/shared-assets/drone-details'
BACKUP = ROOT / 'data/drone-detail-20261015/before'
B = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
F = Matrix.Diagonal(Vector((-1,1,1,1)))
CONFIG = json.loads((CACHE / 'gate-prefab-config.json').read_text())
RESOURCES = json.loads((CACHE / 'browser-track-resources.json').read_text())
ROOTS = {r['name']: r for r in CONFIG['roots']}
RECORDS = list(CONFIG['records'].values())

def vec(d): return Vector(tuple(d.get('m_'+a, d.get(a.lower(), 0)) for a in 'XYZ'))
def convert(m): return B @ F @ m @ F @ B.inverted()
def runtime(v): return [v.x, v.z, -v.y]
def slug(value):
    import re
    return 'lf-' + re.sub('[^a-zA-Z0-9]+','-',re.sub('([a-z])([A-Z])',r'\1-\2',value)).lower()
def label(value): return value.replace('-', '_')

class Prefab:
    def __init__(self, name):
        self.name=name; self.root=ROOTS[name]
        self.records=[r for r in RECORDS if r['collection']==self.root['collection']]
        self.byid={r['id']:r for r in self.records}
        self.transforms={r['data']['m_GameObject']['m_PathID']:r for r in self.records if r['type']=='Transform'}
        self.cache={}
        self.origin=self.world(self.root['id']).inverted()
        self.structure=next((r['data']['m_Structure'] for r in self.records if r['type']=='MonoBehaviour' and r['data'].get('m_Structure',{}).get('id')==name),{})
    def world(self, go):
        if go in self.cache:return self.cache[go]
        t=self.transforms[go]['data']; q=t['m_LocalRotation']
        m=Matrix.LocRotScale(vec(t['m_LocalPosition']),Quaternion(tuple(q['m_'+a] for a in 'WXYZ')),vec(t['m_LocalScale']))
        parent=t['m_Father']['m_PathID']
        if parent!='0':m=self.world(self.byid[parent]['data']['m_GameObject']['m_PathID']) @ m
        self.cache[go]=m;return m
    def belongs(self, go):
        if go==self.root['id']:return True
        t=self.transforms.get(go); p=t['data']['m_Father']['m_PathID'] if t else '0'
        return p!='0' and self.belongs(self.byid[p]['data']['m_GameObject']['m_PathID'])
    def active(self, go):
        if not self.byid[go]['data'].get('m_IsActive',True):return False
        if go==self.root['id']:return True
        p=self.transforms[go]['data']['m_Father']['m_PathID']
        return p=='0' or self.active(self.byid[p]['data']['m_GameObject']['m_PathID'])
    def mount(self, field):
        r=self.byid[self.structure[field]['m_PathID']]
        go=r['data']['m_GameObject']['m_PathID'] if r['type'] in ('Transform','MonoBehaviour') else r['id']
        m=self.origin@self.world(go)
        if field=='batterySlot':
            children=[self.byid[p['m_PathID']] for p in self.transforms[go]['data']['m_Children']]
            snap=next((r for r in children if self.byid[r['data']['m_GameObject']['m_PathID']]['name']=='SnapPoint'),None)
            return m @ (self.world(go).inverted()@self.world(snap['data']['m_GameObject']['m_PathID']) if snap else Matrix.Identity(4))
        s=r['data'].get('m_Structure',{})
        if 'snapRotation' in s:m=m@Matrix.LocRotScale(vec(s['snapPosition']),Quaternion(tuple(s['snapRotation'][a] for a in 'wxyz')),vec(s['snapScale']))
        return m
    def snap_inverse(self):
        snaps=[r for r in self.records if r['type']=='GameObject' and r['name']=='SnapPoint' and self.belongs(r['id'])]
        if len(snaps)>1:raise ValueError('Ambiguous native camera mount '+self.name)
        return (self.origin@self.world(snaps[0]['id'])).inverted() if snaps else Matrix.Identity(4)
    def wires(self, placement):
        result=[]
        for r in self.records:
            s=r['data'].get('m_Structure',{})
            if r['type']!='MonoBehaviour' or 'wirePathCreator' not in s:continue
            go=r['data']['m_GameObject']['m_PathID']
            if not self.belongs(go) or not self.active(go):continue
            path=self.byid[s['wirePathCreator']['m_PathID']]['data']['m_Structure']['editorData']['_bezierPath']
            matrix=convert(placement@self.origin@self.world(go))
            points=[matrix@(B@F@Vector((p['x'],p['y'],p['z']))) for p in path['points']]
            result.append({'points':points,'connection':s['connection'],'radius':s.get('radius',.0012),'source':r['id'],'name':self.byid[go]['name']})
        return result

def empty(name):
    obj=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(obj);return obj

def wire_object(name, points, radius, connection, parent):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8
    curve.bevel_depth=radius;curve.bevel_resolution=2;curve.resolution_u=8;curve.use_fill_caps=True
    spline=curve.splines.new('BEZIER');spline.bezier_points.add((len(points)-1)//3)
    for i,anchor in enumerate(spline.bezier_points):
        n=i*3;anchor.co=points[n];anchor.handle_left_type='FREE';anchor.handle_right_type='FREE'
        anchor.handle_left=points[n-1] if n else points[0]-(points[1]-points[0])
        anchor.handle_right=points[n+1] if n+1<len(points) else points[-1]+(points[-1]-points[-2])
    obj=bpy.data.objects.new(name,curve);bpy.context.scene.collection.objects.link(obj);obj.parent=parent
    curve.materials.append(RED if connection==0 else BLACK)
    obj['sourceProceduralPath']=name;obj['preserveDetail']=True
    return obj

def material(name,color,roughness=.52,metallic=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*color,1);shader.inputs['Roughness'].default_value=roughness;shader.inputs['Metallic'].default_value=metallic
    return mat

def bounds(objects):
    points=[obj.matrix_world@Vector(c) for obj in objects for c in obj.bound_box]
    return {'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}

def add_prefab(prefab,placement,parent):
    filters={r['data']['m_GameObject']['m_PathID']:r for r in prefab.records if r['type']=='MeshFilter'}
    result=[]
    for renderer in prefab.records:
        if renderer['type']!='MeshRenderer' or not renderer['data'].get('m_Enabled'):continue
        go=renderer['data']['m_GameObject']['m_PathID']
        if not prefab.belongs(go) or not prefab.active(go):continue
        reference=filters[go]['data']['m_Mesh']
        if reference['m_PathID']=='0':continue
        identity=ptr(prefab.root['collection'],reference)
        if identity not in MESH_CACHE:
            before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(CACHE/SOURCES[identity]['file']));parts={}
            import re
            for obj in set(bpy.data.objects)-before:
                if obj.type=='MESH':
                    match=re.search(r'SubMesh_(\d+)',obj.name);parts[int(match.group(1)) if match else len(parts)]=obj.data
                bpy.data.objects.remove(obj,do_unlink=True)
            MESH_CACHE[identity]=parts
        for index,source in MESH_CACHE[identity].items():
            data=source.copy();data.materials.clear();refs=renderer['data']['m_Materials'];ref=refs[min(index,len(refs)-1)]
            data.materials.append(MATERIALS[ptr(prefab.root['collection'],ref)])
            for face in data.polygons:face.material_index=0
            obj=bpy.data.objects.new(parent.name+'_'+prefab.byid[go]['name']+'_'+str(index),data);bpy.context.scene.collection.objects.link(obj)
            obj.matrix_world=convert(placement@prefab.origin@prefab.world(go));matrix=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=matrix;result.append(obj)
    return result

def ptr(collection,reference):
    key=json.dumps(collection,separators=(',',':'));collection=RESOURCES['collectionDependencies'][key][str(reference['m_FileID'])]
    return json.dumps(collection,separators=(',',':'))+':'+reference['m_PathID']

if __name__=='__main__':
    scratch=ROOT/'data/drone-detail-20261015/blender-temp';scratch.mkdir(parents=True,exist_ok=True)
    # Python 3.13's Windows mkdtemp(mode=0700) grants only the normal token;
    # sandbox child tokens cannot read that directory. Use inherited workspace
    # permissions for temporary texture conversion and keep it under data/.
    def workspace_mkdtemp(suffix=None,prefix=None,dir=None):
        path=scratch/((prefix or 'image-')+next(tempfile._get_candidate_names())+(suffix or ''))
        os.mkdir(path,0o777);return str(path)
    tempfile.mkdtemp=workspace_mkdtemp;tempfile.tempdir=str(scratch)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    OUT.mkdir(parents=True,exist_ok=True);BACKUP.mkdir(parents=True,exist_ok=True)
    RED=material('Restored live silicone insulation',(.38,.007,.004));BLACK=material('Restored ground silicone insulation',(.008,.009,.011))
    PREFABS={name:Prefab(name) for name in ROOTS}
    if '--inspect' in sys.argv:
        for identifier,frame in [('luma-5','Luma5Frame01'),('armattan-chameleon','ArmattanChameleonFrame01'),('armattan-gecko','ArmattanGeckoFrame01'),('dquad-addiction','DquadAddictionFrame01')]:
            p=PREFABS[frame];print('FRAME_PATH',identifier,[{'connection':w['connection'],'start':runtime(w['points'][0]),'end':runtime(w['points'][-1])} for w in p.wires(Matrix.Identity(4))], 'camera',runtime(convert(p.mount('actionCamSlot')).translation),'battery',runtime(convert(p.mount('batterySlot')).translation),flush=True)
        raise SystemExit(0)
    MATERIALS,IMAGES,_=build_materials(RESOURCES,CACHE);MESH_CACHE={};SOURCES={m['key']:m for m in RESOURCES['meshes']}
    report={'date':'2026-10-15','source':'Preserved Liftoff prefab recovery; no installation extraction','aircraft':{},'lods':[]}
    library=json.loads((ROOT/'content/shared-assets/liftoff-drone-parts/preparation.json').read_text())
    provenance={'sourceGame':'Liftoff: FPV Drone Racing','source':'https://www.liftoff-game.com/','author':'LuGus Studios and originally credited manufacturers','license':'Proprietary game content; redistribution permission unconfirmed','permissionConfirmed':False,'localOnly':True,'testAuthorization':{'date':'2026-10-15','scope':'Existing imported aircraft and additive details for the previously authorized Oracle multiplayer test only'},'changes':'Restored authored procedural electrical paths and native camera meshes/UVs from preserved prefabs; extended battery lead ends to matching frame terminals. Camera placement adapters for Kestrel and Gecko are authored arrangements of the preserved camera and strap, not new source extraction.'}
    for identifier,frame_name in [('luma-5','Luma5Frame01'),('armattan-chameleon','ArmattanChameleonFrame01'),('armattan-gecko','ArmattanGeckoFrame01'),('dquad-addiction','DquadAddictionFrame01'),('kestrel',None)]:
        prefix=label(identifier);drones=ROOT/'content/drones'/identifier;drone=json.loads((drones/'drone.json').read_text())
        record={'frameWires':[],'batteries':{},'camera':{}}
        battery_nodes={};frame_node=None
        if frame_name:
            frame=PREFABS[frame_name];frame_wires=frame.wires(Matrix.Identity(4));frame_node=prefix+'_ElectricalFrame';parent=empty(frame_node)
            for wire in frame_wires:
                wire_object(parent.name+'_'+str(wire['connection']),wire['points'],wire['radius'],wire['connection'],parent)
                record['frameWires'].append({'sourcePath':wire['source'],'connection':wire['connection'],'start':runtime(wire['points'][0]),'end':runtime(wire['points'][-1])})
            candidates=['AmpAgeBattery01','HyperionBattery2S01'] if identifier=='armattan-gecko' else ['TattuRline6SBattery01','TattuRline4SBattery01','AhtechInfinityBattery01']
            for battery_name in candidates:
                part_id=slug(battery_name);node=prefix+'_ElectricalBattery_'+label(part_id);battery_nodes[part_id]=node;parent=empty(node)
                wires=PREFABS[battery_name].wires(frame.mount('batterySlot'));joins=[]
                for wire in wires:
                    target=next(w for w in frame_wires if w['connection']==wire['connection'])['points'][-1]
                    points=wire['points'];old_end=points[-1].copy();start=points[0];gap=target-old_end
                    # Preserve the source battery exit and original first tangent.
                    # The runtime source originally connected the final segment.
                    points[-1]=target
                    tangent=(target-start).normalized()
                    points[-2]=target-tangent*min(.018,(target-start).length*.3)
                    if len(points)==4:points[1]=start+(points[1]-start).normalized()*min(.016,(target-start).length*.28)
                    wire_object(node+'_'+str(wire['connection']),points,wire['radius'],wire['connection'],parent)
                    joins.append({'sourcePath':wire['source'],'connection':wire['connection'],'exit':runtime(start),'terminal':runtime(target),'connectedGapMetres':0,'originalUnconnectedGapMetres':gap.length})
                record['batteries'][part_id]=joins
        camera_source='ActionCamFrontHDMountv1Luma501' if identifier=='luma-5' else 'ActionCamSessionNoMount01'
        cam=PREFABS[camera_source];camera_parent=empty(prefix+'_ActionCamera')
        if identifier=='luma-5':
            # This specialized prefab has no SnapPoint and its mounting base is
            # authored directly in Luma frame coordinates. Applying its slot a
            # second time leaves the camera floating above and ahead of the nose.
            placement=Matrix.Identity(4)
        elif frame_name and identifier!='armattan-gecko':placement=frame.mount('actionCamSlot')@cam.snap_inverse()
        else:
            # The Gecko source intentionally disables its optional camera slot.
            # A removable strap arrangement is placed on its front top plate.
            # Kestrel uses its own authored normalized body axes, already baked.
            native_position=Vector((0,.035,.014)) if identifier=='armattan-gecko' else Vector((0,0,.002))
            placement=F@Matrix.Translation(native_position)@F@cam.snap_inverse()
        camera_objects=add_prefab(cam,placement,camera_parent);bpy.context.view_layer.update()
        box=bounds(camera_objects);center=Vector(tuple((box['min'][i]+box['max'][i])/2 for i in range(3)))
        camera_mass=.133 if identifier=='luma-5' else .074
        record['camera']={'sourcePart':camera_source,'node':camera_parent.name,'mass':camera_mass,'centerOfMass':runtime(center),'boundsBlender':box,'mountKind':'authored frame-relative mounting base' if identifier=='luma-5' else 'native source socket' if identifier not in ('kestrel','armattan-gecko') else 'removable camera and strap adapted to top plate','cosmeticOnly':True}
        model_lods=[{'model':'../../shared-assets/drone-details/'+level+'-delivery.glb','distance':distance} for level,distance in [('hangar',0),('low',12),('far',40)]]
        electrical={'model':model_lods[0]['model'],'modelLods':model_lods,'lowLod':1,'frameNode':frame_node,'batteryNodes':battery_nodes,'localOnly':True,'attributionFile':'../../shared-assets/drone-details/SOURCE.json'}
        accessory={'id':'session-action-camera' if identifier!='luma-5' else 'front-hd-action-camera','name':'Session action camera' if identifier!='luma-5' else 'Front HD action camera','model':model_lods[0]['model'],'modelLods':[dict(lod,modelNode=camera_parent.name) for lod in model_lods],'lowLod':1,'modelNode':camera_parent.name,'mountMatrix':[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],'mass':camera_mass,'dragArea':.0018,'centerOfMass':runtime(center),'cosmeticOnly':True,'assetLicense':provenance['license'],'assetCredit':provenance['author'],'assetSource':provenance['source'],'localOnly':True,'attributionFile':'../../shared-assets/drone-details/SOURCE.json'}
        sidecar={'visualDetails':electrical,'accessories':{'actionCamera':accessory}}
        (drones/'details.json').write_text(json.dumps(sidecar,indent=2)+'\n',encoding='utf8');report['aircraft'][identifier]=record
    # Remove unreferenced recovered images/materials, while retaining all textures
    # actually used by the authored camera meshes. Avoid packing the whole cache.
    for _ in range(3):bpy.ops.outliner.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
    bpy.ops.file.pack_all();bpy.context.scene['detailSource']='SOURCE.json';bpy.context.scene['qualityNote']='Original source meshes and editable authored Bezier wiring; Low visual review required'
    if (OUT/'details.blend').exists() and not (BACKUP/'details.blend').exists():shutil.copy2(OUT/'details.blend',BACKUP/'details.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'details.blend'),compress=True)
    for level in ['hangar','low','far']:
        bpy.ops.wm.open_mainfile(filepath=str(OUT/'details.blend'))
        for obj in list(bpy.context.scene.objects):
            if obj.type=='CURVE':
                obj.data.resolution_u={'hangar':8,'low':5,'far':3}[level];obj.data.bevel_resolution={'hangar':2,'low':1,'far':1}[level]
                bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
                bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')
            elif obj.type=='MESH' and level!='hangar':
                bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
                modifier=obj.modifiers.new('Small accessory delivery','DECIMATE');modifier.ratio=.6 if level=='low' else .22;modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
        triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
        bpy.ops.export_scene.gltf(filepath=str(OUT/(level+'-source.glb')),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
        report['lods'].append({'level':level,'libraryTriangles':triangles})
    (OUT/'SOURCE.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf8');(OUT/'preparation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('DRONE_DETAILS',json.dumps({'aircraft':list(report['aircraft']),'lods':report['lods']}),flush=True)
