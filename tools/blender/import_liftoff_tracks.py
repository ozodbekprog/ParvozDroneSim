"""Convert original checkpoint graphs, trigger bounds and spawns to race JSON."""
import json,sys,math,struct,xml.etree.ElementTree as ET
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import ROOT,RECOVERY,PROFILE
folder=RECOVERY/'source-tracks';config=json.loads((RECOVERY/'gate-prefab-config.json').read_text())
records=config['records'];roots={r['name']:r for r in config['roots']}
def key(c,i):return json.dumps(c,separators=(',',':'))+':'+str(i)
records={key(r['collection'],r['id']):r for r in records.values()}
mesh_files={entry['key']:entry['file'] for entry in json.loads((RECOVERY/'track-resources.json').read_text())['meshes']}
def exported_bounds(mesh):
    # AssetRipper emits empty GLBs for Unity's builtin trigger meshes. These
    # are invisible bounds, not replacement visual art. Unity documents their
    # dimensions in its PrimitiveObjects manual.
    builtin={'Sphere':(.5,.5,.5),'Cylinder':(.5,1,.5),'Capsule':(.5,1,.5),'Quad':(.5,.5,0),'Plane':(5,0,5)}
    if mesh['name'] in builtin:return Vector((0,0,0)),Vector(builtin[mesh['name']])
    file=RECOVERY/mesh_files[key(mesh['collection'],mesh['id'])]
    with file.open('rb') as source:
        source.seek(12);length=struct.unpack('<I',source.read(4))[0];source.seek(20);document=json.loads(source.read(length))
    accessors=[document['accessors'][p['attributes']['POSITION']] for m in document['meshes'] for p in m['primitives']]
    lo=Vector(tuple(min(a['min'][i] for a in accessors) for i in range(3)));hi=Vector(tuple(max(a['max'][i] for a in accessors) for i in range(3)))
    center=(lo+hi)/2;center.x=-center.x
    return center,(hi-lo)/2
def same(c):return [r for r in records.values() if r['collection']==c]
def v(d):return Vector(tuple(d.get('m_'+a,0) for a in 'XYZ'))
def xmlv(root,path,default=(0,0,0)):
    e=root.find(path);return Vector(default) if e is None else Vector(tuple(float(e.findtext(a,'0')) for a in 'xyz'))
def blueprint_matrix(item,prefab):
    p=xmlv(item,'position');r=xmlv(item,'rotation');q=Quaternion((1,0,0,0))
    # Unity Quaternion.Euler uses Z-X-Y application order.
    for axis,angle in [((0,1,0),r.y),((1,0,0),r.x),((0,0,1),r.z)]:q=q@Quaternion(Vector(axis),math.radians(angle))
    transforms={t['data']['m_GameObject']['m_PathID']:t['data'] for t in same(prefab['collection']) if t['type']=='Transform'}
    scale=xmlv(item,'scale',tuple(v(transforms[prefab['id']]['m_LocalScale'])))
    return Matrix.LocRotScale(p,q,scale),transforms
def component_world(go,item,prefab):
    root_matrix,transforms=blueprint_matrix(item,prefab)
    def walk(identity):
        if identity==prefab['id']:return root_matrix
        t=transforms[identity];q=t['m_LocalRotation']
        local=Matrix.LocRotScale(v(t['m_LocalPosition']),Quaternion(tuple(q['m_'+a] for a in 'WXYZ')),v(t['m_LocalScale']))
        parent=records[key(prefab['collection'],t['m_Father']['m_PathID'])]['data']['m_GameObject']['m_PathID']
        return walk(parent)@local
    return walk(go)
def checkpoint(item,subid):
    prefab=roots[item.findtext('itemID')];c=prefab['collection'];items=same(c)
    transforms={r['data']['m_GameObject']['m_PathID']:r['data'] for r in items if r['type']=='Transform'}
    def belongs(go):
        if go==prefab['id']:return True
        t=transforms.get(go)
        if not t or t['m_Father']['m_PathID']=='0':return False
        return belongs(records[key(c,t['m_Father']['m_PathID'])]['data']['m_GameObject']['m_PathID'])
    candidates=[r for r in items if r['type']=='MonoBehaviour' and belongs(r['data']['m_GameObject']['m_PathID']) and r['data'].get('m_Structure',{}).get('subID')==subid and 'attachedRenderer' in r['data'].get('m_Structure',{})]
    if len(candidates)!=1:raise ValueError('Ambiguous checkpoint '+item.findtext('itemID')+' / '+subid)
    source=candidates[0];structure=source['data']['m_Structure'];renderer=records[key(c,structure['attachedRenderer']['m_PathID'])]
    go=renderer['data']['m_GameObject']['m_PathID'];matrix=component_world(go,item,prefab)
    filter=next(r for r in items if r['type']=='MeshFilter' and r['data']['m_GameObject']['m_PathID']==go)
    # Only two meshes are used by these checkpoint renderers. Preserve exact
    # custom bounds; Unity's generated builtin Cube has unit dimensions.
    mesh=next(r for r in records.values() if r['type']=='Mesh' and r['id']==filter['data']['m_Mesh']['m_PathID'])
    bounds=mesh['data']['m_LocalAABB'];center=v(bounds['m_Center']);extent=v(bounds['m_Extent'])
    if mesh['name']=='Cube':extent=Vector((.5,.5,.5))
    elif extent.length<.000001:center,extent=exported_bounds(mesh)
    axes=[matrix.to_3x3()@Vector(tuple(1 if a==i else 0 for a in range(3))) for i in range(3)]
    sizes=[2*extent[i]*axes[i].length for i in range(3)];thin=min(range(3),key=lambda i:sizes[i]);vertical=max((i for i in range(3) if i!=thin),key=lambda i:abs(axes[i].normalized().y));horizontal=next(i for i in range(3) if i not in (thin,vertical))
    position=matrix@center;normal=axes[thin].normalized()
    basis=lambda axis:list(Vector((-axis.x,axis.y,axis.z)).normalized())
    return {'position':[-position.x,position.y,position.z],'normal':Vector((-normal.x,normal.y,normal.z)),'axes':{'right':basis(axes[horizontal]),'up':basis(axes[vertical])},'width':sizes[horizontal],'height':sizes[vertical],'aperture':'ellipse' if mesh['name'] in ('Sphere','Cylinder') else 'rectangle',
        'sourceCheckpoint':{'instanceId':item.findtext('instanceID'),'itemId':item.findtext('itemID'),'subId':subid}}
tracks={}
for path in folder.glob('*Track*.xml'):
    tree=ET.parse(path).getroot();tracks[tree.findtext('localID/str')]=(path,tree,{b.findtext('instanceID'):b for b in tree.find('blueprints')})
manifest=json.loads((folder/'manifest.json').read_text());report=[]
for number,path in enumerate(sorted(folder.glob('*Race*.xml')),1):
    race=ET.parse(path).getroot();track_path,track,items=tracks[race.findtext('dependencies/dependency/str')]
    if track.findtext('environment')!=manifest['scene']:raise ValueError('Race references another environment')
    passages={p.findtext('uniqueId'):p for p in race.find('checkPointPassages')}
    start=[p for p in passages.values() if p.findtext('passageType')=='Start']
    if len(start)!=1:raise ValueError('Expected one start passage')
    branching=any(len(p.findall('nextPassageIDs/string'))>1 for p in passages.values())
    if branching and PROFILE.get('trackOptions',{}).get('linearBranches'):
        def complete_path(p,seen):
            identity=p.findtext('uniqueId')
            if identity in seen:return None
            if p.findtext('passageType')=='Finish':return [p]
            for successor in p.findall('nextPassageIDs/string'):
                path=complete_path(passages[successor.text],seen|{identity})
                if path:return [p]+path
            return None
        order=complete_path(start[0],set())
        if not order:raise ValueError('Source branching graph has no complete route')
        visited={p.findtext('uniqueId') for p in order};current=order[-1]
    else:order=[];current=start[0];visited=set()
    while True:
        if order and branching and PROFILE.get('trackOptions',{}).get('linearBranches'):break
        identity=current.findtext('uniqueId')
        if identity in visited:raise ValueError('Unexpected checkpoint graph cycle')
        visited.add(identity);order.append(current)
        if current.findtext('passageType')=='Finish':break
        successors=current.findall('nextPassageIDs/string')
        if len(successors)!=1:raise ValueError('Branching checkpoint graph requires explicit support')
        current=passages[successors[0].text]
    if len(visited)!=len(passages) and not (branching and PROFILE.get('trackOptions',{}).get('linearBranches')):raise ValueError('Unreachable checkpoint passages')
    spawn_item=items.get(race.findtext('spawnPointID'))
    if spawn_item is None:spawn=PROFILE['course']['spawn']
    else:
        p=xmlv(spawn_item,'position');r=xmlv(spawn_item,'rotation')
        spawn={'position':[-p.x,p.y+.25,p.z],'yaw':-math.radians(r.y)}
    # Our countdown begins at spawn. The source Start/Finish shares one portal;
    # keep Finish once per lap instead of requiring two consecutive crossings.
    ordered=order[1:];gates=[];adjustments=[]
    for index,passage in enumerate(ordered):
        item=items[passage.findtext('checkPointID')];gate=checkpoint(item,passage.findtext('checkPointSubID',''));normal=gate.pop('normal')
        previous=checkpoint(items[order[index].findtext('checkPointID')],order[index].findtext('checkPointSubID',''))['position']
        incoming=Vector(gate['position'])-Vector(previous)
        # Preserve the original portal plane, including slanted/horizontal gates.
        if normal.dot(incoming)<0:normal=-normal;adjustments.append(index)
        gate['axes']['normal']=list(normal)
        gate.update({'yaw':math.atan2(normal.x,normal.z),'gateClass':'open','frameThickness':.05,'support':{'type':'none','baseY':0}})
        gate['sourceCheckpoint'].update({'passageId':passage.findtext('uniqueId'),'directionality':passage.findtext('directionality'),'passageType':passage.findtext('passageType')})
        gates.append(gate)
    identifier=PROFILE['id']+'-liftoff-'+str(number).zfill(2);destination=ROOT/'content/races'/identifier;destination.mkdir(parents=True,exist_ok=True)
    result={'id':identifier,'name':race.findtext('name')+(' — Route A' if branching else ''),'map':PROFILE['id'],'laps':int(race.findtext('requiredLaps')),'spawn':spawn,'gates':gates}
    if (destination/'race.json').exists():
        previous=json.loads((destination/'race.json').read_text())
        for field in ['objects','colliders']:
            if field in previous:result[field]=previous[field]
        if result.get('objects'):
            for gate in gates:gate['frameSource']='track'
    (destination/'race.json').write_text(json.dumps(result,indent=2)+'\n')
    old_source=json.loads((destination/'SOURCE.json').read_text()) if (destination/'SOURCE.json').exists() else {}
    source={**old_source,**PROFILE['provenance'],'trackResource':track_path.stem,'raceResource':path.stem,'sourceTrackId':track.findtext('localID/str'),'sourceRaceId':race.findtext('localID/str'),
        'conversion':'Original checkpoint graph, positions, prefab trigger bounds and spawn preserved. Empty builtin mesh bounds are recovered from the exported source geometry. Source Start is folded into Finish once per lap; our countdown begins at spawn. Gate normal sign follows the ordered route. '+('Authored checkpoint frames are embedded in track props.' if result.get('objects') else 'Authored track props must be imported before activation.')}
    (destination/'SOURCE.json').write_text(json.dumps(source,indent=2)+'\n')
    if spawn_item is None and PROFILE.get('course',{}).get('spawnSource'):
        source['spawnSource']=PROFILE['course']['spawnSource']
        (destination/'SOURCE.json').write_text(json.dumps(source,indent=2)+'\n')
    if branching:
        source['branchAdaptation']='One complete legal Start-to-Finish source branch is exposed as Route A; other source alternatives are not active in this linear course.'
        source['selectedPassages']=[p.findtext('uniqueId') for p in order]
        (destination/'SOURCE.json').write_text(json.dumps(source,indent=2)+'\n')
    report.append({'id':identifier,'name':result['name'],'laps':result['laps'],'gates':len(gates),'sourcePassages':len(order),'originalPassages':len(passages),'linearBranchAdaptation':branching,'normalSignOrientations':adjustments})
(RECOVERY/'imported-tracks.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
