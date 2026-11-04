"""Compare source vs delivered architecture with repeatable surface probes."""
import bpy,json,sys,math,struct,shutil,gc
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import ROOT,RECOVERY,PROFILE,MAP_FOLDER,NODE_PREFIX
from export_package import is_authoring
B=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
excluded_runtime_materials=set()
def opaque(obj):
    return all(not m or (m.name not in excluded_runtime_materials and (not m.use_nodes or not any(n.type=='BSDF_PRINCIPLED' and (n.inputs['Alpha'].is_linked or n.inputs['Alpha'].default_value<.99) for n in m.node_tree.nodes))) for m in obj.data.materials)
def bvh(objects):
    vertices=[];triangles=[];owners=[]
    for obj in objects:
        mesh=obj.data;mesh.calc_loop_triangles();offset=len(vertices)
        vertices.extend(obj.matrix_world@v.co for v in mesh.vertices)
        triangles.extend(tuple(offset+i for i in tri.vertices) for tri in mesh.loop_triangles)
        owners.extend([obj.name]*len(mesh.loop_triangles))
    return BVHTree.FromPolygons(vertices,triangles,all_triangles=True),len(triangles),owners
bpy.ops.wm.open_mainfile(filepath=str(MAP_FOLDER/'map.blend'))
source=[o for o in bpy.context.scene.objects if o.type=='MESH' and not is_authoring(o) and opaque(o)]
reference,source_triangles,source_owners=bvh(source)
bounds=json.loads((RECOVERY/'assembly-report.json').read_text())['bounds']
terrain=(RECOVERY/'terrain-report.json').exists()
probes=[]
spacing=max(2,math.ceil(math.sqrt((bounds['max'][0]-bounds['min'][0])*(bounds['max'][2]-bounds['min'][2])/25000)))
for x in range(math.ceil(bounds['min'][0])+1,math.floor(bounds['max'][0]),spacing):
    for z in range(math.ceil(bounds['min'][2])+1,math.floor(bounds['max'][2]),spacing):
        height=1.4
        if terrain:
            top=Vector((x,bounds['max'][1]+2,z));hit=reference.ray_cast(B@top,B@Vector((0,-1,0)),bounds['max'][1]-bounds['min'][1]+4)
            if hit[0] is not None:height=(B.inverted()@hit[0]).y+1.4
        position=Vector((x,height,z));
        for direction in [(0,-1,0),(0,1,0),(1,0,0),(0,0,1)]:
            origin=B@position;ray=B@Vector(direction);hit=reference.ray_cast(origin,ray,30)
            if hit[0] is not None and hit[3]>.04:probes.append((origin,ray,hit[3],list(position),list(direction),source_owners[hit[2]]))
print('REFERENCE_PROBES',len(probes),flush=True)
definitions=json.loads((RECOVERY/'runtime-objects.json').read_text())
delivery=RECOVERY/'audit-delivery.glb'
def select_lod(index):
    global excluded_runtime_materials
    # Select one level before Blender imports it, avoiding three full mesh copies.
    with delivery.open('rb') as src:
        src.seek(12);length,kind=struct.unpack('<II',src.read(8));document=json.loads(src.read(length));binary_offset=20+length
        # Blender's MASK shader need not connect the Principled Alpha input.
        # Use glTF alpha semantics so cutout fences are filtered consistently.
        excluded_runtime_materials={m.get('name') for m in document.get('materials',[]) if m.get('alphaMode','OPAQUE')!='OPAQUE'}
        names={d['modelLods'][index]['modelNode'] for d in definitions}
        roots=[i for i,node in enumerate(document['nodes']) if node.get('name') in names]
        kept=set()
        def visit(i):
            kept.add(i)
            for child in document['nodes'][i].get('children',[]):visit(child)
        for i in roots:visit(i)
        remap={old:new for new,old in enumerate(sorted(kept))}
        mesh_ids=sorted({document['nodes'][i]['mesh'] for i in kept if 'mesh' in document['nodes'][i]});meshes={old:new for new,old in enumerate(mesh_ids)}
        nodes=[]
        for old in sorted(kept):
            node=dict(document['nodes'][old])
            if 'children' in node:node['children']=[remap[i] for i in node['children']]
            if 'mesh' in node:node['mesh']=meshes[node['mesh']]
            nodes.append(node)
        document['nodes']=nodes;document['meshes']=[document['meshes'][i] for i in mesh_ids]
        document['scenes']=[{'nodes':[remap[i] for i in roots]}];document['scene']=0
        payload=json.dumps(document,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
        target=RECOVERY/'audit-single-lod.glb';remaining=delivery.stat().st_size-binary_offset
        with target.open('wb') as dst:
            dst.write(struct.pack('<III',0x46546c67,2,20+len(payload)+remaining));dst.write(struct.pack('<II',len(payload),0x4e4f534a));dst.write(payload)
            src.seek(binary_offset);shutil.copyfileobj(src,dst,1024*1024)
    return target
report={**json.loads((RECOVERY/'audit-delivery.json').read_text()),'sourceTriangles':source_triangles,'surfaceProbes':len(probes),'gridSpacingMetres':spacing,'sampling':'deterministic spatial grid; not exhaustive surface coverage','levels':[]}
selected=next((int(arg.split('=')[1]) for arg in sys.argv if arg.startswith('--lod=')),None)
for index in range(3) if selected is None else [selected]:
    bpy.ops.wm.read_factory_settings(use_empty=True);gc.collect()
    bpy.ops.import_scene.gltf(filepath=str(select_lod(index)))
    objects=[]
    for definition in definitions:
        root=bpy.data.objects.get(definition['modelLods'][index]['modelNode'])
        if not root:raise ValueError('Missing named LOD root')
        root.location=B@Vector(definition['position'])
        objects.extend(o for o in root.children_recursive if o.type=='MESH' and opaque(o))
    bpy.context.view_layer.update()
    tree,count,owners=bvh(objects);missed=[];moved=[]
    for origin,ray,distance,position,direction,source_name in probes:
        hit=tree.ray_cast(origin,ray,30)
        if hit[0] is None or hit[3]>distance+.25:missed.append({'position':position,'direction':direction,'referenceDistance':distance,'deliveryDistance':hit[3],'sourceObject':source_name})
        elif abs(hit[3]-distance)>.05:moved.append({'position':position,'direction':direction,'delta':hit[3]-distance,'referenceDistance':distance,'deliveryDistance':hit[3],'sourceObject':source_name,'deliveryObject':owners[hit[2]]})
    report['levels'].append({'lod':index,'triangles':count,'missingSurfaces':len(missed),'movedSurfaces':len(moved),'examples':missed[:30],'movedExamples':moved[:30]})
    print('SURFACE_COVERAGE',index,len(missed),'/',len(probes),flush=True)
    del tree,objects;gc.collect()
(RECOVERY/('geometry-coverage.json' if selected is None else 'geometry-inspection-lod%d.json'%selected)).write_text(json.dumps(report,indent=2))
if PROFILE['lod'].get('preserveGeometry') and any(level['missingSurfaces'] or level['movedSurfaces'] for level in report['levels']):
    raise RuntimeError('LOD delivery changed the reference surfaces; do not package this model.')
