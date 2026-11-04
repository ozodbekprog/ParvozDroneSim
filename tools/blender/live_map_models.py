r"""Incremental, native mesh authoring in the already open Blender scene.

MCP usage, after loading the intended content/maps/<id>/map.blend in Blender:
    import sys; sys.path.insert(0, r'C:\DroneLiftoffUz\tools\blender')
    import live_map_models as live
    live.setup('hangar')
    live.architecture('hangar')
    live.details('hangar')
    live.finish('hangar')

Each phase is independent of operators, external assets and background Blender.
The caller owns opening, inspecting, saving and publishing the scene. setup only
removes this module's own collection. Existing editable geometry is retained.
Coordinates below are game metres (x, up, depth); Blender uses (x, -depth, up).
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
MAPS = ('canyon', 'forest', 'hangar', 'industrial', 'neon', 'nightgrid',
        'orbital', 'pinecrest', 'ridgeway', 'ruins', 'sunscar')
PREFIX = 'MCP Authored'
STATES = {}


def cv(p):
    return (p[0], -p[2], p[1])


def _remove_collection(collection):
    for child in list(collection.children):
        _remove_collection(child)
    for obj in list(collection.objects):
        mesh = obj.data if obj.type == 'MESH' else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    bpy.data.collections.remove(collection)


def _mat(map_id, name, color, metallic=0, roughness=.76, emission=0):
    key = f'{PREFIX} {map_id} {name}'
    mat = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = emission
    return mat


def _distance(x, z, a, b):
    dx, dz = b[0]-a[0], b[2]-a[2]
    t = max(0., min(1., ((x-a[0])*dx+(z-a[2])*dz)/max(dx*dx+dz*dz, 1e-8)))
    return math.hypot(x-a[0]-t*dx, z-a[2]-t*dz)


class Builder:
    def __init__(self, map_id):
        self.id = map_id
        self.rng = random.Random(1271 + MAPS.index(map_id))
        self.origin = (0, 0, 0)
        self.yaw = 0
        self.phase = 'architecture'
        self.courses = []
        for path in sorted((ROOT/'content'/'races').glob('*/race.json')):
            course = json.loads(path.read_text(encoding='utf-8-sig'))
            if course.get('map') == map_id:
                self.courses.append(course)
        if not self.courses:
            raise ValueError('No courses for '+map_id)
        self.course = max(self.courses, key=lambda value: len(value['gates']))
        self.gate = self.course['gates'][min(2, len(self.course['gates'])-1)]
        self.routes = []
        self.gates = []
        self.spawns = []
        for course in self.courses:
            points = [course['spawn']['position']] + [g['position'] for g in course['gates']]
            self.routes.extend(zip(points, points[1:]))
            if course.get('laps',1)>1:
                self.routes.append((points[-1],points[1]))
            self.gates.extend(course['gates'])
            self.spawns.append(course['spawn']['position'])
        self.root = bpy.data.collections.new(f'{PREFIX} {map_id} crafted environment')
        bpy.context.scene.collection.children.link(self.root)
        self.root['authoredWith'] = 'Live Blender MCP incremental native mesh authoring'
        self.visual = bpy.data.collections.new(f'{PREFIX} {map_id} architecture and detail')
        self.proxy = bpy.data.collections.new(f'{PREFIX} {map_id} collision proxies')
        self.root.children.link(self.visual)
        self.root.children.link(self.proxy)
        self.proxy['flightAuthoring'] = True
        self.proxy.hide_render = True
        self.mats = {
            'steel': _mat(map_id, 'brushed steel', (.14,.20,.22), .65, .42),
            'wall': _mat(map_id, 'warm plaster', (.58,.59,.52)),
            'wood': _mat(map_id, 'timber', (.29,.15,.063), roughness=.88),
            'woodlight': _mat(map_id, 'cut timber', (.51,.31,.12), roughness=.89),
            'stone': _mat(map_id, 'natural stone', (.43,.34,.23), roughness=.93),
            'stonewarm': _mat(map_id, 'sandstone stratum', (.65,.36,.17), roughness=.95),
            'stonelight': _mat(map_id, 'pale stone stratum', (.74,.53,.30), roughness=.95),
            'green': _mat(map_id, 'needle foliage', (.055,.15,.075), roughness=.94),
            'leaf': _mat(map_id, 'leaf canopy', (.13,.28,.11), roughness=.97),
            'red': _mat(map_id, 'oxide paint', (.49,.085,.035), .12),
            'teal': _mat(map_id, 'teal paint', (.035,.29,.31), .22),
            'ochre': _mat(map_id, 'safety ochre', (.85,.47,.045), .12),
            'glass': _mat(map_id, 'blue glazing', (.075,.25,.32), .35, .23),
            'dark': _mat(map_id, 'rubber and asphalt', (.037,.047,.048), roughness=.9),
            'light': _mat(map_id, 'warm luminaires', (.9,.68,.32), roughness=.42, emission=1.2),
            'cyan': _mat(map_id, 'cyan luminaires', (.03,.65,.79), .1, .35, 1.5),
            'pink': _mat(map_id, 'magenta luminaires', (.8,.035,.36), .1, .35, 1.2),
        }
        self.main_site = self.find_site()
        self.root['landmarkPositionGame'] = list(self.main_site)
        self.root['passageGate'] = self.course['id']+' '+str(self.course['gates'].index(self.gate)+1)

    def find_site(self):
        """Find an open area beside the course, avoiding legacy box proxies."""
        gx, _, gz = self.gate['position']
        yaw = self.gate['yaw']
        c, s = math.cos(yaw), math.sin(yaw)
        obstacle_bounds = []
        for obj in bpy.context.scene.objects:
            if obj.type != 'MESH' or not obj.get('flightCollider'):
                continue
            # Whole imported mesh bounds are not useful as occupancy bounds.
            if obj.get('collisionType') == 'mesh':
                continue
            corners = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
            lo = [min(p[n] for p in corners) for n in range(3)]
            hi = [max(p[n] for p in corners) for n in range(3)]
            if hi[2] < .65 or hi[0]-lo[0] > 150 or hi[1]-lo[1] > 150:
                continue
            obstacle_bounds.append((lo[0], hi[0], -hi[1], -lo[1]))
        indoor = self.id in ('hangar', 'orbital')
        limit = 145 if indoor else 330
        choices = []
        for offset in (48,64,82,106,132,164,198):
            for side in (-1,1):
                for forward in (0,28,-28,54,-54):
                    x = gx + side*offset*c + forward*s
                    z = gz - side*offset*s + forward*c
                    if abs(x)>limit or abs(z)>limit:
                        continue
                    route_gap = min(_distance(x,z,a,b) for a,b in self.routes)
                    spawn_gap = min(math.hypot(x-p[0],z-p[2]) for p in self.spawns)
                    blocks = sum(x+24>a and x-24<b and z+24>d and z-24<e
                                 for a,b,d,e in obstacle_bounds)
                    penalty = max(0,34-route_gap)*20 + max(0,36-spawn_gap)*20 + blocks*200 + offset*.05
                    choices.append((penalty, x, z))
        if not choices:
            raise ValueError('No landmark site fits scene bounds')
        penalty,x,z = min(choices)
        self.root['siteOccupancyPenalty'] = round(penalty,3)
        return (x,.22,z)

    def frame(self, position=None, yaw=0):
        self.origin = position or self.main_site
        self.yaw = yaw

    def passage_frame(self):
        x,y,z = self.gate['position']
        self.frame((x,0,z), self.gate['yaw'])
        return max(12.,self.gate['width']+6), y+self.gate['height']/2+1.6

    def world(self,p):
        c,s = math.cos(self.yaw),math.sin(self.yaw)
        return (self.origin[0]+p[0]*c+p[2]*s,
                self.origin[1]+p[1], self.origin[2]-p[0]*s+p[2]*c)

    def mesh(self, name, vertices, faces, material='steel', solid=False, box_proxy=False, bevel=0):
        name = f'{PREFIX} {self.id} {name}'
        data = bpy.data.meshes.new(name)
        data.from_pydata([cv(p) for p in vertices], [], faces)
        data.materials.append(self.mats[material])
        data.update()
        uv = data.uv_layers.new(name='UVMap')
        # Metre based per-face planar UVs remain useful for later image texturing.
        for polygon in data.polygons:
            axis = max(range(3), key=lambda n: abs(polygon.normal[n]))
            axes = [n for n in range(3) if n != axis]
            for li in polygon.loop_indices:
                co = data.vertices[data.loops[li].vertex_index].co
                uv.data[li].uv = (co[axes[0]]*.25,co[axes[1]]*.25)
        obj = bpy.data.objects.new(name,data)
        self.visual.objects.link(obj)
        obj.location = cv(self.origin)
        obj.rotation_euler.z = self.yaw
        obj['nativeEditable'] = True
        obj['authoredPhase'] = self.phase
        obj['map'] = self.id
        if bevel:
            modifier=obj.modifiers.new('Crafted edge bevel','BEVEL')
            modifier.width=bevel
            modifier.segments=1
        if solid:
            proxy=bpy.data.objects.new(name+' collision',data)
            self.proxy.objects.link(proxy)
            proxy.location=obj.location
            proxy.rotation_euler=obj.rotation_euler
            proxy['flightCollider']=True
            proxy['authoring_only']=True
            proxy['collisionType']='box' if box_proxy else 'mesh'
            proxy['map']=self.id
            proxy.hide_render=True
            proxy.display_type='WIRE'
            proxy.hide_set(True)
        return obj

    def box(self,name,p,size,material='steel',solid=True,bevel=.035):
        vertices=[tuple(p[n]+size[n]*q[n]/2 for n in range(3)) for q in
                  [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                   (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        return self.mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),
                                        (1,2,6,5),(2,3,7,6),(3,0,4,7)],material,solid,True,bevel)

    def beam(self,name,a,b,r=.12,material='steel',solid=False,n=10,r2=None):
        aa,bb=Vector(a),Vector(b)
        direction=(bb-aa).normalized()
        u=direction.cross(Vector((0,1,0)) if abs(direction.y)<.9 else Vector((1,0,0))).normalized()
        v=direction.cross(u)
        vertices=[tuple(point+radius*(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n)))
                  for point,radius in ((aa,r),(bb,r if r2 is None else r2)) for i in range(n)]
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        return self.mesh(name,vertices,faces,material,solid)

    def prism(self,name,profile,z0,z1,material='steel',solid=True):
        # profile is a counter-clockwise polygon in game x/up, extruded in depth.
        area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(profile,profile[1:]+profile[:1]))
        if area<0:profile=list(reversed(profile))
        n=len(profile)
        vertices=[(x,y,z) for z in (z0,z1) for x,y in profile]
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        return self.mesh(name,vertices,faces,material,solid)

    def arch(self,name,width,spring,depth,thickness=.5,material='steel',rise=None,segments=16,z=0):
        rx=width/2;ry=rx if rise is None else rise
        vertices=[]
        for zz in (z-depth/2,z+depth/2):
            for outer in (False,True):
                for i in range(segments+1):
                    theta=i*math.pi/segments
                    vertices.append(((rx+(thickness if outer else 0))*math.cos(theta),
                                     spring+(ry+(thickness if outer else 0))*math.sin(theta),zz))
        stride=segments+1;layer=stride*2;faces=[]
        for i in range(segments):
            faces += [(i,i+1,layer+i+1,layer+i),
                      (stride+i,layer+stride+i,layer+stride+i+1,stride+i+1),
                      (i,stride+i,stride+i+1,i+1),
                      (layer+i,layer+i+1,layer+stride+i+1,layer+stride+i)]
        faces += [(0,layer,layer+stride,stride),
                  (segments,stride+segments,layer+stride+segments,layer+segments)]
        return self.mesh(name,vertices,[tuple(reversed(face)) for face in faces],material,True)

    def gable(self,name,width,depth,eaves=7,rise=4,material='wood'):
        t=.32
        for side in (-1,1):
            profile=[(0,eaves+rise),(side*width/2,eaves),
                     (side*width/2,eaves+t),(0,eaves+rise+t)]
            if side>0:profile.reverse()
            self.prism(name+' sloped roof',profile,-depth/2-.7,depth/2+.7,'steel')
        for z in (-depth/2,depth/2):
            self.prism(name+' gable end',[(-width/2,eaves),(width/2,eaves),(0,eaves+rise)],z-.18,z+.18,material)
        self.beam(name+' ridge cap',(0,eaves+rise+.35,-depth/2-.8),
                  (0,eaves+rise+.35,depth/2+.8),.15,'steel')

    def lodge(self,name,width=24,depth=22,eaves=7,rise=4,material='wood',opening=6):
        self.box(name+' foundation',(0,.16,0),(width+1,.3,depth+1),'stone',False)
        for x in (-width/2,width/2):
            self.box(name+' side wall',(x,eaves/2,0),(.42,eaves,depth),material)
        for z in (-depth/2,depth/2):
            wing=(width-opening)/2
            for side in (-1,1):
                self.box(name+' door wing',(side*(opening/2+wing/2),eaves/2,z),(wing,eaves,.42),material)
            self.box(name+' door header',(0,eaves-.65,z),(opening,1.3,.5),'woodlight')
        self.gable(name,width+1,depth,eaves,rise,material)
        for z in (-depth/2-.25,depth/2+.25):
            for x in (-opening/2,opening/2):
                self.box(name+' timber door jamb',(x,(eaves-1.3)/2,z),(.35,eaves-1.3,.5),'woodlight')
        for x in (-width/2-.25,width/2+.25):
            for z in (-depth*.25,depth*.25):
                self.box(name+' glazed window',(x,4.4,z),(.08,2,3.4),'glass',False,0)
                for dz in (-1.9,1.9):
                    self.box(name+' window stile',(x,4.4,z+dz),(.18,2.4,.2),'woodlight',False)

    def truss(self,name,a,b,height=.8,material='steel',panels=5):
        aa,bb=Vector(a),Vector(b)
        lift=Vector((0,height,0))
        self.beam(name+' lower chord',aa,bb,.13,material,True)
        self.beam(name+' upper chord',aa+lift,bb+lift,.13,material,True)
        for i in range(panels):
            p=aa+(bb-aa)*i/panels;q=aa+(bb-aa)*(i+1)/panels
            self.beam(name+' diagonal',p+(lift if i%2 else Vector()),
                      q+(Vector() if i%2 else lift),.085,material)

    def tree(self,name,x,z,height=15,evergreen=False):
        lean=self.rng.uniform(-1,1)
        self.beam(name+' tapered trunk',(x,0,z),(x+lean,height*.64,z+.35),.52,'wood',True,9,.24)
        for i in range(3):
            theta=i*2.3;spread=2.5+i*.5;y=height*(.43+i*.12)
            end=(x+math.cos(theta)*spread,y+2.3,z+math.sin(theta)*spread)
            self.beam(name+' branch',(x+lean*.5,y,z),end,.18,'wood',True,7,.06)
        if evergreen:
            for i in range(3):
                y=height*(.30+i*.19)
                self.beam(name+' irregular needle crown',(x,y,z),(x+lean*.6,y+height*.42,z),
                          4.1-i*.85,'green',False,9,.15)
        else:
            for i in range(3):
                theta=i*2.3
                self.rock(name+' irregular leaf crown',(x+math.cos(theta)*2,height*.70+i*.5,z+math.sin(theta)*2),
                          (4.3,4.5,3.8),'leaf',False,10,4)

    def rock(self,name,p,size,material='stonewarm',solid=True,n=10,layers=5):
        if material != 'leaf':
            return self.layered_rock(name,p,size,material,solid,n,layers)
        vertices=[]
        for j in range(layers+1):
            theta=math.pi*j/layers
            radial=max(.10,math.sin(theta))
            for i in range(n):
                angle=i*math.tau/n
                wobble=1+self.rng.uniform(-.14,.14)
                vertices.append((p[0]+size[0]*radial*math.cos(angle)*wobble,
                                 p[1]+size[1]*math.cos(theta),
                                 p[2]+size[2]*radial*math.sin(angle)*wobble))
        faces=[tuple(reversed(range(n))),tuple(range(layers*n,(layers+1)*n))]
        faces += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i)
                  for j in range(layers) for i in range(n)]
        return self.mesh(name,vertices,faces,material,solid)

    def layered_rock(self,name,p,size,material,solid,n,layers):
        # Native, stratified sandstone with a broad planted foot, offset ledges
        # and angular fractures. The same mesh is used by its physical proxy.
        n=max(18,n*2);layers=max(8,layers*2)
        phase=self.rng.random()*math.tau
        radial=[.86,.98,.91,.80,.92,.76,.83,.65,.69,.44,.27]
        vertices=[]
        for j in range(layers+1):
            t=j/layers;row=min(len(radial)-1,round(t*(len(radial)-1)))
            shoulder=radial[row]
            dx=math.sin(t*3.8+phase)*size[0]*.10
            dz=math.cos(t*3.3+phase)*size[2]*.08
            for i in range(n):
                a=i*math.tau/n
                c,s=math.cos(a),math.sin(a)
                x=math.copysign(abs(c)**.72,c)
                z=math.copysign(abs(s)**.72,s)
                fracture=1+.10*math.sin(3*a+phase)+.07*math.sin(7*a+t*4)
                height=p[1]+size[1]*(2*t-1)
                if j not in (0,layers):height+=size[1]*.035*math.sin(5*a+phase)
                vertices.append((p[0]+dx+size[0]*shoulder*x*fracture,
                                 height,p[2]+dz+size[2]*shoulder*z*fracture))
        faces=[tuple(reversed(range(n))),tuple(range(layers*n,(layers+1)*n))]
        for j in range(layers):
            for i in range(n):
                a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+(i+1)%n;d=(j+1)*n+i
                faces.extend(((a,b,c),(a,c,d)))
        obj=self.mesh(name,vertices,faces,material,solid)
        obj['nativeStratifiedRock']=True
        if material=='stonewarm':
            obj.data.materials.append(self.mats['stonelight'])
            for polygon in obj.data.polygons:
                if polygon.index>=2 and ((polygon.index-2)//(n*2))%4==2:
                    polygon.material_index=1
        return obj

    def crate(self,name,x,z,y=0):
        self.box(name+' timber case',(x,y+1,z),(2.4,2,2.2),'wood')
        for dx in (-.95,.95):
            self.box(name+' retaining strap',(x+dx,y+1,z),(.1,2.06,2.26),'steel',False)

    def bench(self,name,x,z):
        self.box(name+' top',(x,1.7,z),(4,.18,1.2),'woodlight')
        for dx in (-1.5,1.5):
            self.box(name+' leg',(x+dx,.85,z),(.22,1.7,.9),'steel')


def _state(map_id):
    if map_id not in STATES:
        raise RuntimeError('Call setup for this open map before its other phases')
    b=STATES[map_id]
    if b.root.name not in bpy.context.scene.collection.children:
        raise RuntimeError('The Blender scene changed; call setup for the current map')
    return b


def setup(map_id):
    if map_id not in MAPS:
        raise ValueError('Supported maps: '+', '.join(MAPS))
    scene=bpy.context.scene
    current=scene.get('map_id')
    if current and current!=map_id:
        raise ValueError(f'Open scene belongs to {current}, requested {map_id}')
    for collection in list(bpy.data.collections):
        if collection.name.startswith(f'{PREFIX} {map_id} crafted environment'):
            _remove_collection(collection)
    STATES[map_id]=Builder(map_id)
    return {'phase':'setup','map':map_id,'site':list(STATES[map_id].main_site),
            'gate':STATES[map_id].root['passageGate']}


def _remove_phase(b,phase):
    for obj in list(b.visual.objects):
        if obj.get('authoredPhase')!=phase:
            continue
        for proxy in list(b.proxy.objects):
            if proxy.data==obj.data:
                bpy.data.objects.remove(proxy,do_unlink=True)
        data=obj.data
        bpy.data.objects.remove(obj,do_unlink=True)
        if data.users==0:bpy.data.meshes.remove(data)


def architecture(map_id):
    b=_state(map_id);_remove_phase(b,'architecture');b.phase='architecture';b.frame()
    if map_id=='hangar':
        for x in (-18,18):
            b.box('Maintenance bay sidewall',(x,5,0),(.6,10,30),'wall')
        b.arch('Aircraft maintenance vaulted roof',36,10,31,.38,'steel',rise=6)
        for z in (-15,-5,5,15):
            b.arch('Curved roof rib',35.6,9.85,.26,.20,'ochre',rise=5.85,z=z)
            b.truss('Suspended transverse gantry',(-17,9,z),(17,9,z),.75)
        for z in (-15,15):
            for x in (-17.5,17.5):b.box('Maintenance portal upright',(x,4.5,z),(.65,9,.8),'ochre')
        b.box('Maintenance upper skylight',(0,16.5,0),(3,.08,27),'glass',False,0)
    elif map_id in ('forest','pinecrest'):
        b.lodge('Ranger timber lodge' if map_id=='forest' else 'Creekside pitched cabin',26,24,7.5,4.3)
        b.beam('Stone chimney',(9,0,-6),(9,15,-6),1.2,'stone',True,6)
        b.box('Chimney rain cap',(9,15.2,-6),(3,.35,3),'steel')
        for z in (-19,-15,-11):
            b.box('Veranda deck',(0,.65,z),(28,.28,3.8),'woodlight')
        for x in (-12,12):
            b.truss('Veranda diagonal rail',(x,1.25,-20),(x,1.25,-9),1.1,'wood',4)
    elif map_id=='industrial':
        b.lodge('Loading warehouse',32,30,10,3,'teal',opening=18)
        for x in (-20,20):
            for z in (-12,0,12):b.beam('Scaffold standard',(x,0,z),(x,15,z),.16,'steel',True)
            for y in (4,8,12):
                b.box('Scaffold walk deck',(x,y,0),(4,.15,29),'woodlight')
                b.truss('Scaffold safety lattice',(x,y+.8,-14),(x,y+.8,14),1.1,'steel',7)
        for x in (-9,9):b.box('Loading dock raised apron',(x,1.05,-20),(9,2.1,8),'wall')
        b.truss('Loading dock gantry',(-20,13,-20),(20,13,-20),1.5,'ochre',8)
    elif map_id=='neon':
        for x in (-12,12):
            for z in (-16,0,16):b.box('Transit market slender column',(x,6,z),(.5,12,.5),'teal')
        b.arch('Covered transit market canopy',25,12,35,.30,'steel',rise=3.4)
        for z in (-16,0,16):b.arch('Canopy illuminated rib',24.6,11.9,.16,.12,'cyan',rise=3.3,z=z)
        for x in (-8,8):b.box('Raised rail platform',(x,.65,0),(5,1.3,35),'wall')
        for x in (-1.7,1.7):b.beam('Market light rail',(x,.3,-28),(x,.3,28),.10,'steel',True)
        b.truss('Elevated transit footbridge',(-18,9,18),(18,9,18),1.3,'pink',8)
    elif map_id=='nightgrid':
        for x in (-18,18):b.box('Service depot side wall',(x,5,0),(.55,10,30),'wall')
        profile=[(-18,10),(-18,10.35),(-7,13.3),(-7,10.35),(5,13.3),(5,10.35),(18,13.3),(18,10)]
        b.prism('Garage sculpted sawtooth roof',profile,-15.6,15.6,'steel')
        for x in (-18,-6,6,18):b.box('Garage opening pier',(x,4.2,-15),(.7,8.4,1),'teal')
        b.box('Garage long lintel',(0,9.15,-15),(36,1.7,1),'wall')
        for x in (-7,5,18):b.box('Sawtooth high glazing',(x,11.7,0),(.08,2.3,28),'glass',False,0)
        for x in (-10,10):
            for z in (-7,7):b.box('Hydraulic vehicle lift',(x,2.4,z),(.55,4.8,.55),'ochre')
            b.box('Vehicle lift side track',(x,1,-.4),(2,.24,17),'steel')
    elif map_id=='orbital':
        # Chamfered module hulls and hollow bulkheads are editable extruded meshes.
        profile=[(-17,2),(-13,0),(13,0),(17,2),(17,13),(13,17),(-13,17),(-17,13)]
        for x in (-1,1):
            xx=x*16
            b.prism('Service module chamfered wall',[(xx+a*.10,y) for a,y in profile],-15,15,'wall')
        b.arch('Orbital arched service gallery',32,13,30,.45,'steel',rise=5)
        for z in (-15,-5,5,15):
            b.arch('Module illuminated pressure rib',31.6,12.9,.23,.20,'cyan',rise=4.9,z=z)
        for x in (-12,12):b.box('Service module walkway',(x,1.2,0),(6,.32,30),'wall')
        b.beam('Reactor axial drum',(11,3,-6),(11,11,-6),2.0,'teal',True,18)
        for y in (3.4,6.8,10.5):b.beam('Reactor retaining collar',(11,y,-6),(11,y+.18,-6),2.2,'steel',False,18)
    elif map_id=='ridgeway':
        b.lodge('Ridge farm barn',32,32,9,5,'red',opening=10)
        b.box('Barn loft platform',(0,7,8),(28,.25,12),'woodlight')
        for x in (-20,20):
            for z in (-17,-9,-1,7,15):b.box('Paddock fence post',(x,1.8,z),(.30,3.6,.30),'wood')
            for y in (1.2,2.7):b.box('Paddock fence rail',(x,y,-1),(.18,.20,34),'woodlight')
        b.beam('Farm silo shell',(25,0,10),(25,15,10),4,'steel',True,16)
        b.beam('Farm silo tapered cap',(25,15,10),(25,18,10),4.2,'wall',True,16,.35)
    elif map_id=='ruins':
        for x in (-14,14):
            for z in (-15,-5,5,15):
                b.beam('Temple fluted column',(x,1,z),(x,10.8,z),1.1,'stone',True,12,.93)
                b.box('Temple column capital',(x,11.1,z),(3.2,.8,3.2),'stonelight')
                b.box('Temple column foot',(x,.6,z),(3.4,1.2,3.4),'stonelight')
        for x in (-14,14):b.box('Ruined temple entablature',(x,12,0),(3,1.2,33),'stone')
        b.gable('Temple surviving pediment',30,32,12.5,3.4,'stonelight')
        # A single roof side remains: remove one just-authored slope and proxy.
        slopes=[o for o in b.visual.objects if 'Temple surviving pediment sloped roof' in o.name]
        if slopes:
            obj=slopes[0]
            for p in list(b.proxy.objects):
                if p.data==obj.data:bpy.data.objects.remove(p,do_unlink=True)
            data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
            if data.users==0:bpy.data.meshes.remove(data)
    elif map_id in ('canyon','sunscar'):
        for i in range(4):
            p=(-14+(i%2)*28,7+i*.4,-11+(i//2)*22)
            b.rock('Eroded layered rock base',p,(7,8,6),'stonewarm',True,12,5)
            b.rock('Pale sandstone cap',(p[0]+1,14+i*.4,p[2]),(5,3.2,4.5),'stonelight',True,11,4)
        if map_id=='sunscar':
            b.arch('Desert maintenance culvert',15,2,24,.65,'stone',rise=7.5)
            for x in (-8,8):b.box('Culvert footing',(x,1,0),(1.3,2,24),'stone')
        else:
            b.arch('Freestanding sandstone landmark arch',20,5,6,3.2,'stonewarm',rise=9)
            for x in (-11.5,11.5):b.rock('Arch eroded abutment',(x,3,0),(3.4,5.4,4),'stonewarm')

    # A second close feature frames an actual gate with a generous clear opening.
    width,top=b.passage_frame()
    if map_id in ('canyon','ruins','sunscar'):
        material='stonewarm' if map_id=='canyon' else 'stone'
        b.arch('Course masonry flythrough arch',width,top,5,1.0,material,rise=width*.36,segments=14)
        for x in (-width/2-.5,width/2+.5):
            for i in range(5):
                b.box('Course arch ashlar pier',(x,top*(i+.5)/5,0),(1.0,top/5-.05,5),
                      'stonelight' if i%2 else material)
    elif map_id in ('forest','pinecrest','ridgeway'):
        for x in (-width/2,width/2):
            for z in (-7,7):b.box('Timber crossing portal post',(x,top/2,z),(.5,top,.6),'wood')
            b.truss('Timber crossing side lattice',(x,top-.3,-7),(x,top-.3,7),1.2,'woodlight',5)
        b.gable('Timber crossing pitched canopy',width+1,15,top+.35,2.4,'wood')
        for z in (-7,7):b.truss('Timber crossing overhead frame',(-width/2,top,z),(width/2,top,z),.6,'woodlight')
    else:
        material='pink' if map_id=='neon' else 'cyan' if map_id=='orbital' else 'steel'
        for x in (-width/2,width/2):
            for z in (-7,7):b.box('Service passage upright',(x,top/2,z),(.45,top,.55),'steel')
        b.arch('Course curved service passage',width,top,15,.25,'steel',rise=3)
        for z in (-7,0,7):b.arch('Service passage curved rib',width-.2,top-.05,.16,.18,material,rise=2.95,z=z)
        for x in (-width/2,width/2):
            b.beam('Passage edge luminaire',(x,2,-6.5),(x,2,6.5),.065,material)
    b.root['architectureComplete']=True
    return {'phase':'architecture','map':map_id,'visibleObjects':len(b.visual.objects)}


def details(map_id):
    b=_state(map_id);_remove_phase(b,'details');b.phase='details';b.frame()
    if map_id=='hangar':
        # Parked aircraft: shaped fuselage, tapered swept wings, tail and landing gear.
        for side in (-1,1):
            x=side*10
            b.beam('Aircraft tapered fuselage',(x,2.7,-7),(x,2.7,7),.65,'wall',True,12,.23)
            b.prism('Aircraft swept main wing',[(x-5,2.58),(x-5,2.78),(x,2.94),(x+5,2.78),(x+5,2.58)],-1.3,1.3,'teal')
            b.prism('Aircraft horizontal tail',[(x-2.4,2.65),(x-2.4,2.8),(x+2.4,2.8),(x+2.4,2.65)],5.8,7.1,'ochre')
            b.prism('Aircraft vertical tail',[(x-.07,2.7),(x+.07,2.7),(x+.07,4.5),(x-.07,4.5)],5.7,7,'teal')
            for dz in (-4,3):
                b.beam('Aircraft landing strut',(x,2.3,dz),(x,.7,dz),.11,'steel')
                b.beam('Aircraft landing wheel',(x-.27,.62,dz),(x+.27,.62,dz),.49,'dark',True,12)
        for x in (-15,15):
            for z in (-10,0,10):
                b.bench('Maintenance workbench',x,z)
                b.box('Maintenance tool cabinet',(x,.9,z+1.6),(2.8,1.8,.8),'red')
                b.beam('Hanging task lamp',(x,8,z-1.5),(x,8,z+1.5),.09,'light')
    elif map_id in ('forest','pinecrest'):
        for i,(x,z) in enumerate([(-22,-8),(23,2),(-21,20),(22,24)]):
            b.tree('Hand shaped woodland tree '+str(i),x,z,13+i*1.7,map_id=='pinecrest')
        for z in (-18,-14):
            for x in (-7,7):b.bench('Veranda timber bench',x,z)
        for i in range(8):
            z=-25-i*2
            b.box('Creek boardwalk plank',(0,.8,z),(9,.20,1.8),'woodlight')
        for x in (-4.3,4.3):
            for z in (-26,-34,-42):b.box('Boardwalk rail post',(x,1.5,z),(.2,2.5,.2),'wood')
            b.beam('Boardwalk handrail',(x,2.6,-25),(x,2.6,-43),.10,'wood')
        for i in range(5):b.beam('Stacked sawn log',(8+i*.5,1,-17),(8+i*.5,1,-23),.28,'wood',True,8)
    elif map_id=='industrial':
        for i in range(4):
            x=-11+i*7
            b.crate('Loading cargo '+str(i),x,-24)
            b.beam('Process pipe riser',(x,0,18),(x,7,18),.5,'steel',True)
            b.beam('Process pipe horizontal',(x,7,18),(x,7,27),.5,'steel',True)
            b.beam('Pipe flanged coupling',(x,7,22),(x,7,22.22),.68,'ochre',False,12)
        for y in range(1,14):b.beam('Scaffold ladder rung',(-22,y,-12),(-18,y,-12),.065,'ochre')
        for x in (-12,12):
            for z in (-10,0,10):b.bench('Factory assembly bench',x,z)
    elif map_id=='neon':
        for x in (-8,8):
            for z in (-11,0,11):
                b.box('Market kiosk lower cabinet',(x,2,z),(4,2.5,3.5),'teal')
                b.prism('Market kiosk sloping awning',[(x-2.6,5.2),(x+2.6,5.2),(x+2.6,5.45),(x-2.6,5.45)],z-2.2,z+2.2,'pink')
                b.box('Market luminous sign',(x,4.4,z-1.82),(3.5,.75,.13),'cyan',False)
                for dx in (-1.2,0,1.2):b.box('Market display parcel',(x+dx,3.6,z),(1,.65,1.0),'ochre' if dx else 'red')
        for x in (-8,8):
            for z in (-21,21):b.bench('Transit platform bench',x,z)
        for z in range(-24,25,8):b.box('Transit sleeper',(0,.14,z),(5,.16,.40),'wood',False)
    elif map_id=='nightgrid':
        for x in (-13,13):
            for z in (-10,0,10):
                b.bench('Depot mechanic bench',x,z)
                b.box('Depot tool trolley',(x,1.0,z+2),(2.4,2,1.2),'red')
                for dz in (-.4,.4):b.beam('Tool trolley wheel',(x-.9,.4,z+2+dz),(x+.9,.4,z+2+dz),.28,'dark',False,8)
        for x in (-12,0,12):
            b.box('Garage lighting strip',(x,8.7,0),(7,.12,.4),'light',False)
            b.box('Roof extractor base',(x,13.9,5),(3,.5,3),'steel')
            b.beam('Roof extractor drum',(x,14,5),(x,15.7,5),1.2,'steel',True,12)
        for z in (-10,-3,4,11):b.box('Bay guide line',(0,.035,z),(.12,.02,4),'ochre',False,0)
    elif map_id=='orbital':
        for x in (-14,14):
            for z in (-11,-4,3,10):
                b.box('Module service cabinet',(x,3,z),(2.3,4.6,3.3),'teal')
                b.box('Cabinet control display',(x+(-1.18 if x>0 else 1.18),4,z),(.06,1.4,1.8),'cyan',False,0)
                for y in (2,3.2):b.beam('Cabinet coolant connection',(x,y,z+2),(x,y,z+4),.12,'steel',True)
        for z in (-12,-4,4,12):
            b.box('Gallery ceiling strip',(0,17.8,z),(9,.08,.4),'light',False,0)
            b.box('Module floor segmentation',(0,.08,z),(18,.08,.08),'cyan',False,0)
        for i in range(7):b.beam('Reactor braided coolant line',(8+i*.18,2,-12),(8+i*.18,11,-12),.065,'steel')
    elif map_id=='ridgeway':
        for x in (-13,13):
            for z in (-11,-4,3,10):b.box('Barn vertical facade batten',(x,4.5,z),(.1,8.7,.22),'woodlight',False)
        for i in range(5):b.crate('Farm feed crate '+str(i),-10+i*5,20)
        b.box('Farm wagon bed',(0,1.7,23),(8,.6,4),'woodlight')
        for x in (-2.8,2.8):
            b.beam('Wagon axle',(x,1.1,20.5),(x,1.1,25.5),.16,'steel')
            for z in (20.8,25.2):
                b.beam('Timber wagon wheel',(x,1.1,z-.14),(x,1.1,z+.14),1.05,'wood',True,12)
                b.beam('Wagon wheel iron hub',(x,1.1,z-.2),(x,1.1,z+.2),.2,'steel')
        for y in range(1,16):b.beam('Silo access rung',(28.9,y,9.4),(28.9,y,10.6),.055,'ochre')
    elif map_id=='ruins':
        for i in range(15):
            x=-17+(i%5)*8.5;z=23+(i//5)*4
            b.rock('Broken masonry rubble',(x,.65,z),(1.0,.6,1.4),'stonelight',True,7,3)
        for x in (-14,14):
            for z in (-14,-4,6):
                b.box('Carved colonnade frieze',(x,12.1,z),(3.1,.3,3),'stonelight',False)
                for dz in (-1,1):b.beam('Column relief flute',(x+.98,1.6,z+dz*.3),(x+.98,10.2,z+dz*.3),.065,'stonelight')
        b.beam('Fallen column drum',(-5,1.1,22),(5,1.1,22),1.1,'stone',True,12)
        for i in range(4):b.box('Temple approach step',(0,.18+i*.20,-21+i*1.5),(18,.35+i*.4,1.4),'stone')
    elif map_id in ('canyon','sunscar'):
        for i in range(12):
            x=(-23 if i%2 else 23)+b.rng.uniform(-2,2);z=-25+(i//2)*9
            b.rock('Weathered scree boulder',(x,1.1,z),(1.6,1.1,2),'stonewarm',True,8,3)
        if map_id=='canyon':
            for x in (-14,14):
                for y in (3,6,9,12):
                    b.beam('Exposed sandstone horizontal seam',(x-5,y,-11),(x+5,y,-11),.095,'stonelight')
            for i in range(6):b.box('Canyon timber trail step',(0,.25,-20-i*2),(7,.25,1.7),'woodlight')
        else:
            for i in range(4):
                x=-15+i*10
                b.beam('Solar tracker pedestal',(x,0,24),(x,3.4,24),.25,'steel',True)
                b.prism('Solar tracker tilted panel',[(x-4,3.5),(x+4,5.3),(x+4,5.5),(x-4,3.7)],20,28,'glass')
                for z in (21,23,25,27):
                    b.beam('Photovoltaic cell divider',(x-3.8,3.65,z),(x+3.8,5.36,z),.025,'steel')
            for x in (-6,6):b.box('Canal service curb',(x,.6,-20),(.4,1.2,15),'stone')
    # Readable structural junctions add detail without increasing the material set.
    width,top=b.passage_frame()
    for x in (-width/2,width/2):
        for z in (-6.8,6.8):
            material='woodlight' if map_id in ('forest','pinecrest','ridgeway') else 'ochre'
            b.box('Passage support foot',(x,.25,z),(1.1,.5,1.15),'stone')
            b.box('Passage entrance reflector',(x,min(3,top*.3),z-.3),(.62,.42,.15),material,False)
    b.root['detailsComplete']=True
    return {'phase':'details','map':map_id,'visibleObjects':len(b.visual.objects),
            'collisionObjects':len(b.proxy.objects)}


def _clearance(b):
    """Check actual closed proxy volumes, including hollow arches, with native BVH.

    Keep the new models clear of gate centres, gate aperture corners, spawns and
    sampled course centre lines. Only conflicting objects authored by this script
    are removed. A hollow arch's overall bounds never become a solid obstacle.
    """
    samples=[]
    for gate in b.gates:
        x,y,z=gate['position'];yaw=gate['yaw']
        samples.append((Vector(cv((x,y,z))),.42,'gate centre'))
        for side in (-1,1):
            for vertical in (-1,1):
                offset=side*gate['width']/2
                p=(x+offset*math.cos(yaw),y+vertical*gate['height']/2,z-offset*math.sin(yaw))
                samples.append((Vector(cv(p)),.14,'gate aperture'))
    samples.extend((Vector(cv(p)),.65,'spawn') for p in b.spawns)
    for aa,bb in b.routes:
        a,c=Vector(aa),Vector(bb)
        count=max(1,math.ceil((c-a).length/3))
        for i in range(count+1):
            p=a+(c-a)*(i/count)
            samples.append((Vector(cv(p)),.32,'course passage'))
    ray=Vector((1,.371,.183)).normalized()
    removed=[]
    for proxy in list(b.proxy.objects):
        vertices=[proxy.matrix_world@v.co for v in proxy.data.vertices]
        low=Vector(tuple(min(v[n] for v in vertices) for n in range(3)))
        high=Vector(tuple(max(v[n] for v in vertices) for n in range(3)))
        possible=[(point,radius,reason) for point,radius,reason in samples
                  if all(low[n]-radius<=point[n]<=high[n]+radius for n in range(3))]
        if not possible:continue
        tree=BVHTree.FromPolygons(vertices,[list(p.vertices) for p in proxy.data.polygons])
        reason=None
        for point,radius,label in possible:
            nearest=tree.find_nearest(point,radius)
            if nearest[0] is not None:
                reason=label;break
            # Ray parity tests the enclosed volume, including non-convex shells.
            start=point.copy();hits=0
            for _ in range(64):
                hit=tree.ray_cast(start,ray,2000)
                if hit[0] is None:break
                hits+=1;start=hit[0]+ray*.0005
            if hits%2:
                reason=label;break
        if reason:
            data=proxy.data
            removed.append({'object':proxy.name.removesuffix(' collision'),'reason':reason})
            for obj in list(b.visual.objects):
                if obj.data==data:bpy.data.objects.remove(obj,do_unlink=True)
            bpy.data.objects.remove(proxy,do_unlink=True)
            if data.users==0:bpy.data.meshes.remove(data)
    b.root['clearanceSamples']=len(samples)
    b.root['clearanceRemoved']=json.dumps(removed)
    return removed


def finish(map_id):
    """Record reviewable authoring statistics. Caller saves and publishes later."""
    b=_state(map_id)
    if not b.root.get('architectureComplete') or not b.root.get('detailsComplete'):
        raise RuntimeError('Run architecture and details before finish')
    bpy.context.view_layer.update()
    removed=_clearance(b)
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in b.visual.objects)
    b.root['visibleObjects']=len(b.visual.objects)
    b.root['baseTriangles']=triangles
    b.root['collisionObjects']=len(b.proxy.objects)
    b.root['nativeModelVersion']=1
    scene=bpy.context.scene
    scene['mcp_live_authored_map']=map_id
    scene['mcp_live_authored_version']=1
    scene['mcp_live_authored_triangles']=triangles
    for obj in bpy.context.selected_objects:obj.select_set(False)
    visible=[o for o in b.visual.objects if o.type=='MESH']
    if visible:
        visible[0].select_set(True)
        bpy.context.view_layer.objects.active=visible[0]
    return {'phase':'finish','map':map_id,'visibleObjects':len(visible),
            'baseTriangles':triangles,'collisionObjects':len(b.proxy.objects),
            'landmarkGame':list(b.main_site),'passageGate':b.root['passageGate'],
            'clearanceSamples':b.root['clearanceSamples'],'clearanceRemoved':removed,
            'sourceEditable':True,'saved':False,'published':False}
