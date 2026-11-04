"""Harborworks live modeling. Load with runpy INSIDE the user's open Blender.

No mainfile loading, saving, exporting, subprocesses, or external geometry.
Execute phase1(), phase2(), phase3() separately via the Blender MCP connection.
Coordinates below are workshop-local metres (X across, Y along, Z up).
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
TAG = 'harbor_live_workshop_v1'
PREFIX = 'HW Workshop | '
OLD_PREFIX = 'harborworks-dock-circuit pilot feature 2'
ORIGIN = Vector((-32.0, -72.0, 0.0))
ANGLE = math.atan2(.821, .570)
ROT = Matrix.Rotation(ANGLE, 3, 'Z')
COLLECTION = '09 Harborworks crafted pilot workshop'
BOX_FACES = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
M = {}


def collection(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def setup():
    scene = bpy.context.scene
    if scene.get('map_id', 'harborworks') != 'harborworks':
        raise RuntimeError('Open the authored Harborworks map before running this script.')
    for name, color, metallic, rough in [
        ('teal', (.055,.245,.25), .35,.52),
        ('steel', (.075,.115,.135), .75,.4),
        ('galvanized', (.40,.46,.46), .8,.38),
        ('roof', (.14,.205,.22), .65,.52),
        ('brick', (.34,.155,.09), 0,.9),
        ('mortar', (.30,.285,.25), 0,.95),
        ('concrete', (.38,.40,.37), 0,.9),
        ('glass', (.10,.28,.33), .35,.19),
        ('ochre', (.91,.52,.07), .2,.52),
        ('ivory', (.78,.76,.64), 0,.62),
        ('wood', (.38,.215,.09), 0,.78),
        ('rubber', (.024,.031,.035), 0,.87),
        ('red', (.52,.065,.035), .25,.55),
        ('lamp', (.97,.80,.43), .05,.3),
    ]:
        material = bpy.data.materials.get(PREFIX+name) or bpy.data.materials.new(PREFIX+name)
        material.use_nodes = True
        material.diffuse_color = (*color, 1)
        shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = (*color, 1)
        shader.inputs['Metallic'].default_value = metallic
        shader.inputs['Roughness'].default_value = rough
        if name == 'lamp':
            shader.inputs['Emission Color'].default_value = (*color, 1)
            shader.inputs['Emission Strength'].default_value = 2.0
        M[name] = material
    collection(COLLECTION)
    c = collection('COLLISION_PROXIES')
    c['flightAuthoring'] = True
    c.hide_render = True


def mesh(name, vertices, faces, material, bevel=0, phase=1):
    data = bpy.data.meshes.new(PREFIX+name)
    data.from_pydata(vertices, [], faces)
    data.update()
    # Planar projection in metres per face, retaining consistent texel density.
    uv = data.uv_layers.new(name='UVMap')
    for polygon in data.polygons:
        axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for li in polygon.loop_indices:
            p = data.vertices[data.loops[li].vertex_index].co
            uv.data[li].uv = (p[axes[0]]/2, p[axes[1]]/2)
    data.materials.append(M[material])
    ob = bpy.data.objects.new(PREFIX+name, data)
    collection(COLLECTION).objects.link(ob)
    ob.matrix_world = Matrix.Translation(ORIGIN) @ ROT.to_4x4()
    ob[TAG] = phase
    if bevel:
        mod = ob.modifiers.new('Fabricated edge radii', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return ob


def proxy(ob):
    data = ob.data.copy()
    pr = bpy.data.objects.new('COLLIDER | '+ob.name, data)
    collection('COLLISION_PROXIES').objects.link(pr)
    pr.matrix_world = ob.matrix_world.copy()
    pr['flightCollider'] = True
    pr['collisionType'] = 'mesh'
    pr['authoring_only'] = True
    pr[TAG] = ob[TAG]
    pr.hide_render = True
    pr.display_type = 'WIRE'
    pr.hide_set(True)
    return pr


def box(name, center, size, material, bevel=.025, solid=False, phase=1):
    vertices = [(center[0]+x*size[0]/2, center[1]+y*size[1]/2, center[2]+z*size[2]/2)
                for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                              (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    ob = mesh(name, vertices, BOX_FACES, material, bevel, phase)
    if solid: proxy(ob)
    return ob


def extrude(name, profile, axis, lo, hi, material, bevel=.02, solid=False, phase=1):
    # Extrude a crafted polygon in the other two axes. Profile must be CCW.
    axes = [i for i in range(3) if i != axis]
    vertices = []
    for a in [lo, hi]:
        for p in profile:
            v = [0,0,0]
            v[axis] = a
            v[axes[0]], v[axes[1]] = p
            vertices.append(v)
    n = len(profile)
    faces = [tuple(reversed(range(n))), tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    # Swapping X,Z around Y reverses orientation.
    if axis == 1: faces = [tuple(reversed(f)) for f in faces]
    ob = mesh(name, vertices, faces, material, bevel, phase)
    if solid: proxy(ob)
    return ob


def bar(name, a, b, width, depth, material='steel', phase=1, solid=False):
    a, b = Vector(a), Vector(b)
    d = (b-a).normalized()
    u = d.cross(Vector((0,0,1)) if abs(d.z)<.9 else Vector((0,1,0))).normalized()
    v = d.cross(u)
    vertices = [tuple(p+u*x*width/2+v*y*depth/2) for p in [a,b]
                for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    ob = mesh(name, vertices, BOX_FACES, material, .018, phase)
    if solid: proxy(ob)
    return ob


def lathe(name, center, rings, material, segments=16, axis=2, phase=2):
    # rings: (axial offset, radius). This produces shaped hubs, bottles, wheels.
    axes = [i for i in range(3) if i != axis]
    vertices = []
    for height, radius in rings:
        for i in range(segments):
            p = list(center)
            p[axis] += height
            p[axes[0]] += radius*math.cos(i*math.tau/segments)
            p[axes[1]] += radius*math.sin(i*math.tau/segments)
            vertices.append(p)
    faces = [tuple(reversed(range(segments)))]
    for j in range(len(rings)-1):
        faces += [(j*segments+i,j*segments+(i+1)%segments,
                   (j+1)*segments+(i+1)%segments,(j+1)*segments+i) for i in range(segments)]
    faces += [tuple(range((len(rings)-1)*segments,len(rings)*segments))]
    if axis == 1: faces = [tuple(reversed(f)) for f in faces]
    ob = mesh(name,vertices,faces,material,0,phase)
    for p in ob.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return ob


def remove_phase(phase):
    for ob in list(bpy.data.objects):
        if ob.get(TAG) == phase:
            bpy.data.objects.remove(ob, do_unlink=True)


def replace_generic_bay():
    old = [o for o in bpy.context.scene.objects if o.name.startswith(OLD_PREFIX)]
    # Only remove collision proxies geometrically matching a replaced object.
    bounds = []
    for ob in old:
        corners = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
        bounds.append((sum(corners, Vector())/8, sorted(ob.dimensions)))
    removed = []
    for ob in list(bpy.context.scene.objects):
        if not ob.get('flightCollider'): continue
        corners = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
        center = sum(corners, Vector())/8
        dims = sorted(ob.dimensions)
        if any((center-c).length < .04 and max(abs(a-b) for a,b in zip(dims,s)) < .08 for c,s in bounds):
            removed.append(ob.name)
            bpy.data.objects.remove(ob, do_unlink=True)
    for ob in old: bpy.data.objects.remove(ob, do_unlink=True)
    return {'old_objects_removed':len(old), 'old_proxies_removed':len(removed)}


def phase1():
    """Replace just the generic gate-2 bay; create structural workshop shell."""
    setup()
    remove_phase(1)
    removed = replace_generic_bay()
    box('foundation apron', (0,0,.06),(23.4,25,.12),'concrete',.02,True)
    # Masonry plinths and walls frame real open window reveals and service bays.
    for side in [-1,1]:
        x = side*11
        box('brick plinth '+str(side),(x,0,.65),(.65,24,1.3),'brick',.035,True)
        for y in [-12,-4,4,12]:
            # Structural I sections: actual flange/web polygon cross-section.
            w, t, web = .52,.085,.095
            p=[(-w/2,-w/2),(w/2,-w/2),(w/2,-w/2+t),(web/2,-w/2+t),
               (web/2,w/2-t),(w/2,w/2-t),(w/2,w/2),(-w/2,w/2),
               (-w/2,w/2-t),(-web/2,w/2-t),(-web/2,-w/2+t),(-w/2,-w/2+t)]
            extrude('I section column',[(x+a,y+b) for a,b in p],2,.15,10.5,'steel',.015,True)
            box('cast column footing',(x,y,.35),(.95,.95,.7),'concrete',.05,True)
            box('column base plate',(x,y,.73),(.75,.75,.06),'galvanized')
        for y in [-8,0,8]:
            box('lower wall spandrel',(x,y,2.1),(.34,7.5,1.6),'teal',.02,True)
            box('upper wall spandrel',(x,y,9.5),(.34,7.5,1.6),'teal',.02,True)
            # Paired small jambs leave genuinely hollow window/service apertures.
            for yy in [y-3.75,y+3.75]:
                box('window masonry reveal',(x,yy,5.8),(.5,.28,5.8),'brick',.018,True)
        box('eave longitudinal channel',(x,0,10.5),(.32,25,.42),'steel',.02,True)
    # Roof slopes end at a raised monitor, preserving a clerestory gap.
    for side in [-1,1]:
        a,b = sorted([side*11.7,side*2.3])
        height=lambda x: 13.2-abs(x)*.225
        profile=[(a,height(a)),(b,height(b)),(b,height(b)+.16),(a,height(a)+.16)]
        extrude('standing seam roof slope',profile,1,-12.75,12.75,'roof',.018,True)
        # Long folded standing seams follow the pitched plane.
        for i in range(13):
            x=side*(2.45+i*.75); z=height(x)+.18
            extrude('folded roof standing seam',[(x-.035,z),(x+.035,z),(x+.018,z+.10),(x-.018,z+.10)],1,-12.7,12.7,'galvanized',.007)
        box('clerestory sill',(side*2.3,0,12.82),(.17,24.4,.16),'steel')
        box('clerestory glazing',(side*2.3,0,13.38),(.08,24,1.02),'glass',.008,True)
        for y in range(-12,13,3):
            box('clerestory mullion',(side*2.36,y,13.4),(.16,.12,1.25),'ivory',.012)
        a,b = sorted([0,side*2.65])
        profile=[(a,14.45-abs(a)*.19),(b,14.45-abs(b)*.19),
                 (b,14.61-abs(b)*.19),(a,14.61-abs(a)*.19)]
        # Ensure the roof polygon retains CCW order on either slope.
        if sum(profile[i][0]*profile[(i+1)%4][1]-profile[(i+1)%4][0]*profile[i][1] for i in range(4))<0:profile.reverse()
        extrude('monitor pitched cap',profile,1,-12.9,12.9,'roof',.018,True)
    for y in [-12,-4,4,12]:
        bar('truss lower chord',(-10.9,y,10.3),(10.9,y,10.3),.25,.25,solid=True)
        for side in [-1,1]:
            bar('truss rafter',(side*11,y,10.55),(0,y,13.2),.26,.26,solid=True)
            for k in range(4):
                xa=side*k*2.7; xb=side*(k+1)*2.7
                bar('triangulated truss web',(xa,y,10.4),(xb,y,13.1-abs(xb)*.23),.105,.105)
        bar('truss king post',(0,y,10.4),(0,y,13.2),.13,.13)
    for y in [-12.22,12.22]:
        box('open hangar lintel',(0,y,9.94),(21.5,.26,.54),'ochre',.04,True)
        for side in [-1,1]:
            box('sliding door parked leaf',(side*9.7,y,5.4),(1.65,.22,8.3),'teal',.035,True)
            for z in [1.7,3.2,4.7,6.2,7.7,9.2]:
                box('door pressed stiffener',(side*9.7,y-.15,z),(1.52,.08,.08),'galvanized',.008)
            bar('portal knee brace',(side*10.7,y,8.4),(side*8.8,y,10.2),.20,.20)
    bpy.context.scene['harbor_live_model_phase'] = 1
    return {**removed, **summary()}


def phase2():
    """Add authored window assemblies, masonry courses, bench tools and fixtures."""
    setup()
    if not any(o.get(TAG)==1 for o in bpy.context.scene.objects):raise RuntimeError('Run phase1 first')
    remove_phase(2)
    for side in [-1,1]:
        x=side*11
        for z in [.28,.55,.82,1.09]:
            box('mortar bed joint',(x+side*.334,0,z),(.014,23.8,.018),'mortar',0,phase=2)
        for row in range(4):
            for n in range(24):
                yy=-11.6+n+.5*(row%2)
                box('staggered masonry joint',(x+side*.335,yy,.15+row*.27),(.015,.018,.23),'mortar',0,phase=2)
        # Middle side bays remain open; outer bays contain recessed divided glazing.
        for y in [-8,8]:
            box('recessed workshop glazing',(x,y,5.75),(.06,6.9,5.4),'glass',.01,True,2)
            for yy in [y-3.5,y-1.16,y+1.16,y+3.5]:
                box('window vertical frame',(x-side*.24,yy,5.75),(.16,.11,5.6),'ivory',.015,phase=2)
            for z in [2.96,5.65,8.55]:
                box('window horizontal frame',(x-side*.24,y,z),(.20,7.12,.11),'ivory',.012,phase=2)
            box('projecting window sill',(x-side*.2,y,2.93),(.8,7.4,.15),'concrete',.02,phase=2)
        # Gutters have U profiles, visibly hollow rather than solid rectangular rods.
        gx=side*11.78
        profile=[(gx-.19,10.39),(gx+.19,10.39),(gx+.19,10.66),(gx+.14,10.66),
                 (gx+.14,10.44),(gx-.14,10.44),(gx-.14,10.66),(gx-.19,10.66)]
        extrude('open rain gutter',profile,1,-12.65,12.65,'galvanized',.009,False,2)
        lathe('rain downpipe',(gx,11.5,0),[(.15,.10),(10.42,.10)],'galvanized',12)
        for y in [-7.2,6.4]:
            bench(side*8.8,y,side)
        for y in [-10,0,10]:
            box('suspended fixture housing',(side*5,y,9.9),(2.8,.48,.19),'steel',.04,phase=2)
            box('opal fixture diffuser',(side*5,y,9.78),(2.6,.35,.035),'lamp',.012,phase=2)
    # Safety stripes stay beside the aisle; these never cover the course centre.
    for side in [-1,1]:
        box('aisle edge paint',(side*6.4,0,.135),(.10,22,.008),'ochre',0,phase=2)
        for y in [-11,11]:
            lathe('cast safety bollard',(side*8.1,y,0),[(.12,.28),(.24,.28),(.30,.14),(1.3,.14),(1.4,.10)],'ochre',16)
    text_label('workshop entrance lettering','HARBOR  /  WORKSHOP 02',(0,-12.39,9.94),.32)
    text_label('service bay lettering','PILOT SERVICE',(0,12.38,9.94),.30,back=True)
    bpy.context.scene['harbor_live_model_phase'] = 2
    return summary()


def bench(x,y,side):
    name='service bench '+str(x)+' '+str(y)
    box(name+' hardwood top',(x,y,1.55),(2.65,4.0,.18),'wood',.06,True,2)
    for dx in [-1.05,1.05]:
        for dy in [-1.65,1.65]:
            bar(name+' angle leg',(x+dx,y+dy,.16),(x+dx,y+dy,1.46),.12,.12,'steel',2)
    box(name+' lower shelf',(x,y,.40),(2.4,3.65,.09),'steel',.025,phase=2)
    # Freestanding sheet peg rack with folded returns and suspended hand tools.
    rx=x+side*1.17
    box(name+' tool rack back',(rx,y,2.43),(.09,3.72,1.5),'teal',.03,phase=2)
    for yy in [y-1.84,y+1.84]:
        box(name+' folded rack edge',(rx-side*.08,yy,2.43),(.20,.06,1.5),'galvanized',.008,phase=2)
    for i in range(5):
        yy=y-1.4+i*.62
        # Open-ended wrench cut as a single nonrectangular polygon, visible in profile.
        p=[(yy-.055,1.92),(yy+.055,1.92),(yy+.055,2.63),(yy+.17,2.73),
           (yy+.17,2.92),(yy+.085,2.98),(yy+.085,2.79),(yy-.085,2.79),
           (yy-.085,2.98),(yy-.17,2.92),(yy-.17,2.73),(yy-.055,2.63)]
        extrude(name+' open jaw wrench',p,0,rx-side*.18-.025,rx-side*.18+.025,'galvanized',.009,False,2)
    # Machinist vice: cast tapered body, slide and jaws, lead screw and cross handle.
    vx=x-side*.55; vy=y-.8
    extrude(name+' vice cast pedestal',[(vx-.34,1.64),(vx+.34,1.64),(vx+.24,1.88),(vx-.24,1.88)],1,vy-.38,vy+.38,'teal',.04,False,2)
    box(name+' vice slide',(vx,vy,1.92),(.26,.93,.18),'galvanized',.02,phase=2)
    for yy in [vy-.31,vy+.25]:
        box(name+' vice jaw',(vx,yy,2.10),(.68,.15,.31),'steel',.025,phase=2)
        box(name+' hardened jaw face',(vx,yy+.08,2.17),(.66,.025,.14),'galvanized',.005,phase=2)
    lathe(name+' lead screw',(vx,vy-.77,1.92),[(0,.055),(.55,.055)],'galvanized',12,1)
    bar(name+' vice handle',(vx-.33,vy-.76,1.92),(vx+.33,vy-.76,1.92),.045,.045,'galvanized',2)
    # Two recognizable service bottles with shoulders, neck and regulator.
    for dy,material in [(.75,'red'),(1.3,'galvanized')]:
        lathe(name+' fluid bottle',(x-side*.55,y+dy,1.65),[(0,.12),(.05,.15),(.48,.15),(.56,.08),(.68,.06),(.73,.065)],material,16)
    # A ribbed cable reel below the bench, modeled as revolved flanges and barrel.
    lathe(name+' cable reel',(x,y,.60),[(-.48,.44),(-.42,.44),(-.39,.28),(.39,.28),(.42,.44),(.48,.44)],'rubber',20,1)
    lathe(name+' reel spindle',(x,y,.60),[(-.55,.065),(.55,.065)],'galvanized',12,1)


def text_label(name,body,position,size,back=False):
    data=bpy.data.curves.new(PREFIX+name,'FONT')
    data.body=body; data.align_x='CENTER'; data.align_y='CENTER'
    data.size=size; data.extrude=.004
    ob=bpy.data.objects.new(PREFIX+name,data)
    collection(COLLECTION).objects.link(ob)
    # Text lies in local X/Z plane, front faces local -Y.
    ob.matrix_world=Matrix.Translation(ORIGIN) @ ROT.to_4x4() @ Matrix.Translation(Vector(position)) @ Matrix.Rotation(math.pi/2,4,'X')
    if back:ob.matrix_world=ob.matrix_world @ Matrix.Rotation(math.pi,4,'Y')
    ob[TAG]=2
    data.materials.append(M['ivory'])
    # Exporters mesh-filter; convert only our new text without changing existing selection.
    deps=bpy.context.evaluated_depsgraph_get()
    evaluated=ob.evaluated_get(deps)
    md=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps)
    transform=ob.matrix_world.copy()
    bpy.data.objects.remove(ob,do_unlink=True)
    ob=bpy.data.objects.new(PREFIX+name,md);collection(COLLECTION).objects.link(ob)
    ob.matrix_world=transform;ob[TAG]=2


def check_clearance(clearance=.45):
    """Conservative new-proxy bounds check against unchanged course centre paths.

    This is a centreline safeguard, not a proof of full gate-volume clearance.
    Bounds are in workshop coordinates; pitched roof proxies are conservative.
    """
    bounds=[]
    for ob in bpy.context.scene.objects:
        if ob.get(TAG) and ob.get('flightCollider'):
            points=[ROT.transposed() @ ((ob.matrix_world @ v.co)-ORIGIN) for v in ob.data.vertices]
            bounds.append((ob.name,[min(p[i] for p in points)-clearance for i in range(3)],
                           [max(p[i] for p in points)+clearance for i in range(3)]))
    hits=[]
    for path in sorted((ROOT/'content/races').glob('harborworks-*/race.json')):
        race=json.loads(path.read_text(encoding='utf-8'))
        points=[race['spawn']['position']]+[g['position'] for g in race['gates']]+[race['gates'][0]['position']]
        for index,(aa,bb) in enumerate(zip(points,points[1:])):
            a=ROT.transposed() @ (Vector((aa[0],-aa[2],aa[1]))-ORIGIN)
            b=ROT.transposed() @ (Vector((bb[0],-bb[2],bb[1]))-ORIGIN)
            # Exact segment vs inflated AABB avoids gaps in sampling.
            for name,lo,hi in bounds:
                t0,t1=0.,1.
                for axis in range(3):
                    d=b[axis]-a[axis]
                    if abs(d)<1e-9:
                        if a[axis]<lo[axis] or a[axis]>hi[axis]:t0,t1=1.,0.;break
                    else:
                        u,v=sorted(((lo[axis]-a[axis])/d,(hi[axis]-a[axis])/d))
                        t0=max(t0,u);t1=min(t1,v)
                if t0<=t1:hits.append({'race':race['id'],'segment':index,'proxy':name})
    return {'clearance_metres':clearance,'new_proxy_count':len(bounds),'centreline_hits':hits}


def summary():
    objects=[o for o in bpy.context.scene.objects if o.get(TAG)]
    return {'objects':len([o for o in objects if not o.get('flightCollider')]),
            'collision_proxies':len([o for o in objects if o.get('flightCollider')]),
            'phase':bpy.context.scene.get('harbor_live_model_phase',0)}


def phase3():
    """Check route clearance, aim pilot camera, and make the new workshop editable."""
    setup()
    report=check_clearance()
    if report['centreline_hits']:
        return {'status':'CLEARANCE REVIEW REQUIRED',**report}
    camera=bpy.data.objects.get('FPV pilot-height preview') or bpy.context.scene.camera
    if camera and camera.type=='CAMERA':
        camera.location=(-13.93,-84.55,6.4)
        target=ORIGIN+ROT@Vector((0,4,6.25))
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.type='PERSP';camera.data.lens=23
        bpy.context.scene.camera=camera
    for ob in bpy.context.selected_objects:ob.select_set(False)
    main=bpy.data.objects.get(PREFIX+'standing seam roof slope')
    if main:
        main.select_set(True);bpy.context.view_layer.objects.active=main
    bpy.context.scene['harbor_live_model_phase']=3
    bpy.context.scene['harbor_live_model_notes']='Native live-modeled gabled workshop; authored Quayside gate 2; route JSON unchanged'
    bpy.context.view_layer.update()
    return {'status':'ready for visual inspection and parent-controlled save/export',**summary(),**report}
