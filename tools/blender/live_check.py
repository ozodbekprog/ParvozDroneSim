"""Small geometric safety checks for the new live-authored collision surfaces."""
from pathlib import Path
import json
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]

def check(radius=.35):
    map_id=Path(bpy.data.filepath).parent.name
    points=[]
    for path in sorted((ROOT/'content'/'races').glob('*/race.json')):
        race=json.loads(path.read_text(encoding='utf-8-sig'))
        if race.get('map')!=map_id:continue
        points.append((race['id'],'spawn',race['spawn']['position']))
        points.extend((race['id'],'gate '+str(i+1),g['position']) for i,g in enumerate(race['gates']))
    depsgraph=bpy.context.evaluated_depsgraph_get()
    colliders=[obj for obj in bpy.context.scene.objects if obj.type=='MESH' and obj.get('flightCollider') and
               (obj.name.startswith('MCP Authored') or obj.get('harbor_live_workshop_v1'))]
    hits=[]
    for obj in colliders:
        inverse=obj.matrix_world.inverted()
        bvh=BVHTree.FromObject(obj,depsgraph)
        for course,point_name,point in points:
            location=inverse@Vector((point[0],-point[2],point[1]))
            closest,normal,index,distance=bvh.find_nearest(location)
            if closest is None:continue
            touching=distance<radius
            if obj.get('collisionType')=='box':
                minimum=Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
                maximum=Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
                touching=touching or all(minimum[i]<location[i]<maximum[i] for i in range(3))
            if touching:hits.append({'course':course,'point':point_name,'object':obj.name,'distance':round(distance,3)})
    return {'map':map_id,'checkedPoints':len(points),'newProxies':len(colliders),'hardConflicts':hits}
