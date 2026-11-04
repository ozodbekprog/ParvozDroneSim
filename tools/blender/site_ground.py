"""Partition service roads and ground into one continuous, non-overlapping floor.

Large-distance depth/mesh quantization cannot reliably separate stacked planes
a few centimetres apart. Preserve each authored PBR material and UV mapping.
"""
import bpy,numpy as np
from mathutils import Vector

def partition_ground(collection):
    source=[o for o in collection.objects if o.type=='MESH' and (o.get('site_ground') or o.name.startswith('Courtyard concrete'))]
    if len(source)==1 and source[0].name=='Site terrain composite':return
    records=[];materials=[]
    for obj in source:
        points=[obj.matrix_world@v.co for v in obj.data.vertices]
        low=[min(p[a] for p in points) for a in range(3)];high=[max(p[a] for p in points) for a in range(3)]
        mat=obj.data.materials[0]
        if mat not in materials:materials.append(mat)
        matrix=[];uvs={name:[] for name in ['UVMap','UVBake']}
        for loop in obj.data.loops:
            p=points[loop.vertex_index];matrix.append([p.x,p.y,1])
            for name in uvs:
                layer=obj.data.uv_layers.get(name) or obj.data.uv_layers.active
                uvs[name].append(list(layer.data[loop.index].uv))
        mapping={name:np.linalg.lstsq(np.array(matrix),np.array(values),rcond=None)[0] for name,values in uvs.items()}
        priority=100 if obj.name.startswith('Courtyard concrete') else 90 if obj.name.startswith('Site floor') else 80 if 'working apron' in obj.name else 0 if 'terrain apron' in obj.name else 50
        records.append({'low':low,'high':high,'mat':materials.index(mat),'mapping':mapping,'priority':priority})
    xs=sorted(set(v for r in records for v in [r['low'][0],r['high'][0]]));ys=sorted(set(v for r in records for v in [r['low'][1],r['high'][1]]))
    vertices=[];faces=[];face_records=[]
    for x0,x1 in zip(xs,xs[1:]):
        for y0,y1 in zip(ys,ys[1:]):
            x,y=(x0+x1)/2,(y0+y1)/2
            candidates=[r for r in records if r['low'][0]<=x<=r['high'][0] and r['low'][1]<=y<=r['high'][1]]
            if not candidates:continue
            r=max(candidates,key=lambda r:r['priority']);start=len(vertices)
            vertices.extend([(x0,y0,.005),(x1,y0,.005),(x1,y1,.005),(x0,y1,.005)])
            faces.append((start,start+1,start+2,start+3));face_records.append(r)
    mesh=bpy.data.meshes.new('Continuous site ground and service roads');mesh.from_pydata(vertices,[],faces)
    for mat in materials:mesh.materials.append(mat)
    for poly,r in zip(mesh.polygons,face_records):poly.material_index=r['mat']
    for name in ['UVMap','UVBake']:
        layer=mesh.uv_layers.new(name=name)
        for poly,r in zip(mesh.polygons,face_records):
            for li in poly.loop_indices:
                p=mesh.vertices[mesh.loops[li].vertex_index].co
                layer.data[li].uv=np.array([p.x,p.y,1])@r['mapping'][name]
    mesh.uv_layers.active_index=0;mesh.update()
    obj=bpy.data.objects.new('Site terrain composite',mesh);obj['site_ground']=True;collection.objects.link(obj)
    for old in source:bpy.data.objects.remove(old,do_unlink=True)
    print('PARTITIONED_GROUND',len(faces),'non-overlapping patches',flush=True)
