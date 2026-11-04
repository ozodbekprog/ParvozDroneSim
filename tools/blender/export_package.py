"""Developer-only Blender roundtrip for canonical content/maps packages.

Run with npm run content:blender -- --map harborworks --markers or --publish.
Markers are separate native authoring objects; runtime GLB contains geometry only.
"""
from __future__ import annotations

import argparse
import datetime
import json
import math
import shutil
import sys
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]


@contextmanager
def working_directory(prefix='blender-publish-'):
    # Python 3.13's 0700 temporary-directory ACL is incompatible with Windows sandbox tokens.
    parent=(ROOT/'data').resolve();parent.mkdir(exist_ok=True)
    work=parent/(prefix+uuid.uuid4().hex);work.mkdir()
    try:yield str(work)
    finally:
        if not work.resolve().is_relative_to(parent):raise ValueError('Unsafe staging directory')
        shutil.rmtree(work)
MAP_ROOT = ROOT / 'content' / 'maps'
C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')


def finite_vector(value):
    return isinstance(value, (list, tuple)) and len(value) == 3 and all(isinstance(n,(int,float)) and math.isfinite(n) for n in value)


def validate_collisions(colliders):
    if not isinstance(colliders,list):
        raise ValueError('Collision data must be an array.')
    for collider in colliders:
        if collider.get('type') == 'mesh':
            values = collider.get('vertices')
            if not isinstance(values,list) or len(values)%9 or len(values)>900000 or not all(isinstance(n,(int,float)) and math.isfinite(n) and abs(n)<1e6 for n in values):
                raise ValueError('Collision mesh needs finite triangle coordinates and at most 100,000 triangles.')
        elif not finite_vector(collider.get('position')) or not finite_vector(collider.get('size')) or not all(.01 <= n <= 2000 for n in collider['size']) or ('rotation' in collider and not finite_vector(collider['rotation'])):
            raise ValueError('Invalid collision box position, size or rotation.')
        if collider.get('type') == 'capsule':
            radius, half, axis = collider.get('radius'), collider.get('halfLength'), collider.get('axis')
            if axis not in (0, 1, 2) or not isinstance(radius, (int, float)) or not math.isfinite(radius) or not .005 <= radius <= 1000 or not isinstance(half, (int, float)) or not math.isfinite(half) or not 0 <= half <= 1000:
                raise ValueError('Invalid capsule radius, half length or axis.')
            if any(size + 1e-6 < 2 * (radius + (half if index == axis else 0)) for index, size in enumerate(collider['size'])):
                raise ValueError('Capsule bounds must enclose its rounded surface.')
    return colliders


def rounded(values):
    return [round(float(value), 6) for value in values]


def game_point(value):
    return C.transposed() @ Vector(value)


def blender_point(value):
    return C @ Vector(value)


def three_rotation(values):
    x, y, z = values
    return Matrix.Rotation(x, 3, 'X') @ Matrix.Rotation(y, 3, 'Y') @ Matrix.Rotation(z, 3, 'Z')


def three_euler(matrix):
    y = math.asin(max(-1., min(1., matrix[0][2])))
    if abs(matrix[0][2]) < .9999999:
        x = math.atan2(-matrix[1][2], matrix[2][2])
        z = math.atan2(-matrix[0][1], matrix[0][0])
    else:
        x = math.atan2(matrix[2][1], matrix[1][1])
        z = 0.
    return rounded((x, y, z))


def map_races(map_id):
    return [(path, read_json(path)) for path in sorted((ROOT / 'content' / 'races').glob('*/race.json'))
            if read_json(path).get('map') == map_id]


def new_collection(name, parent=None):
    collection = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(collection)
    collection['flightAuthoring'] = True
    collection.hide_render = True
    return collection


def remove_authoring_collection(collection):
    for child in list(collection.children):
        remove_authoring_collection(child)
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)


def is_collider(obj):
    return obj.type == 'MESH' and (obj.get('flightCollider') or obj.get('collider')
                                 or obj.name.upper().startswith('COLLIDER_'))


def is_authoring(obj):
    return bool(is_collider(obj) or obj.get('authoring_only') or obj.get('flightGate')
                or obj.get('flightSpawn') or obj.get('flightGuide')
                or obj.name.upper().startswith(('GATE_', 'SPAWN'))
                or any(collection.get('flightAuthoring') for collection in obj.users_collection))


def wire_guide(name, vertices, edges, collection, parent=None, color=(.25, .75, 1, 1)):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, edges, [])
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = parent
    obj['flightGuide'] = True
    obj['authoring_only'] = True
    obj.hide_render = True
    obj.show_in_front = True
    obj.display_type = 'WIRE'
    obj.color = color
    obj.hide_select = True
    return obj


def marker(name, position, yaw, collection):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.location = blender_point(position)
    obj.rotation_euler.z = yaw
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = .7
    obj.hide_render = True
    obj.show_in_front = True
    obj['authoring_only'] = True
    return obj


def add_routes(map_id):
    old_collections = [collection for collection in bpy.data.collections
                       if collection.name.startswith(('90 Flight Authoring', '90 Authoring route markers'))]
    for collection in old_collections:
        remove_authoring_collection(collection)
    parent = new_collection('90 Flight Authoring — routes (excluded from GLB)')
    total = 0
    for _, race in map_races(map_id):
        collection = new_collection('Route ' + race['id'], parent)
        spawn = race.get('spawn')
        if spawn:
            obj = marker('SPAWN_' + race['id'], spawn['position'], spawn['yaw'], collection)
            obj['flightSpawn'] = True
            obj['track'] = race['id']
            wire_guide('Spawn heading', [(0, 0, 0), (0, -4, 0), (-.5, -3, 0), (.5, -3, 0)],
                       [(0, 1), (1, 2), (1, 3)], collection, obj, (.2, 1, .35, 1))
        for index, gate in enumerate(race['gates']):
            width, height = gate['width'], gate['height']
            obj = marker('GATE_%s_%03d' % (race['id'], index + 1), gate['position'], gate['yaw'], collection)
            for key, value in {'flightGate': True, 'track': race['id'], 'order': index,
                               'width': width, 'height': height,
                               'gateClass': gate.get('gateClass', 'open'),
                               'frameThickness': gate.get('frameThickness', .16),
                               'supportType': gate.get('support', {}).get('type', 'ground'),
                               'supportBaseY': gate.get('support', {}).get('baseY', 0)}.items():
                obj[key] = value
            anchor = obj['supportBaseY'] - gate['position'][1]
            corners = [(-width/2, 0, -height/2), (width/2, 0, -height/2),
                       (width/2, 0, height/2), (-width/2, 0, height/2),
                       (0, 0, 0), (0, -2, 0), (-.3, -1.5, 0), (.3, -1.5, 0)]
            edges = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (5, 7)]
            support = obj['supportType']
            if support in ('ground', 'roof', 'suspended'):
                start = height/2 if support == 'suspended' else -height/2
                for x in (-width/2, width/2):
                    n = len(corners)
                    corners.extend([(x, 0, start), (x, 0, anchor)])
                    edges.append((n, n+1))
            wire_guide('Opening and support %03d' % (index+1), corners, edges, collection, obj)
            total += 1
    bpy.context.scene['flight_authoring_version'] = 1
    bpy.context.scene['map_id'] = map_id
    return total


def add_collision_proxies(package, force=False):
    existing = [obj for obj in bpy.context.scene.objects if is_collider(obj)]
    if existing and not force:
        return len(existing)
    for obj in existing:
        bpy.data.objects.remove(obj, do_unlink=True)
    parent = bpy.data.collections.get('COLLISION_PROXIES')
    if parent is None:
        parent = new_collection('COLLISION_PROXIES')
    parent['flightAuthoring'] = True
    parent.hide_render = True
    proxies = read_json(package / 'collision.json') if (package / 'collision.json').exists() else read_json(package / 'map.json').get('colliders', [])
    for index, collider in enumerate(proxies):
        name = 'COLLIDER_%04d' % (index+1)
        if collider.get('type') == 'mesh':
            values = collider['vertices']
            vertices = [blender_point(values[n:n+3]) for n in range(0, len(values), 3)]
            mesh = bpy.data.meshes.new(name)
            mesh.from_pydata(vertices, [], [tuple(range(n, n+3)) for n in range(0, len(vertices), 3)])
            obj = bpy.data.objects.new(name, mesh)
            parent.objects.link(obj)
            obj['collisionType'] = 'mesh'
        else:
            vertices = [(x*.5, y*.5, z*.5) for x,y,z in
                        [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                         (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
            mesh = bpy.data.meshes.new(name)
            mesh.from_pydata(vertices, [], [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)])
            obj = bpy.data.objects.new(name, mesh)
            parent.objects.link(obj)
            sx, sy, sz = collider['size']
            rb = C @ three_rotation(collider.get('rotation', (0,0,0))) @ C.transposed()
            obj.matrix_world = Matrix.Translation(blender_point(collider['position'])) @ rb.to_4x4() @ Matrix.Diagonal((sx,sz,sy,1))
            obj['collisionType'] = 'box'
            obj['colliderMetadata'] = json.dumps({key:value for key,value in collider.items() if key not in ('position','size','rotation')})
        obj['flightCollider'] = True
        obj['authoring_only'] = True
        obj.hide_render = True
        obj.display_type = 'WIRE'
        obj.color = (1, .2, .18, .7)
    return len(proxies)


def mesh_collision(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        if len(mesh.loop_triangles) > 100000:
            raise ValueError('Collision mesh exceeds 100,000 triangles: ' + obj.name)
        vertices = []
        for triangle in mesh.loop_triangles:
            for index in triangle.vertices:
                vertices.extend(rounded(game_point(evaluated.matrix_world @ mesh.vertices[index].co)))
        return {'type':'mesh', 'vertices':vertices}
    finally:
        evaluated.to_mesh_clear()


def box_collision(obj):
    value = json.loads(obj.get('colliderMetadata', '{}'))
    matrix = obj.matrix_world.to_3x3()
    lengths = [matrix.col[index].length for index in range(3)]
    if min(lengths) < 1e-8:
        raise ValueError('Zero-sized collider: ' + obj.name)
    basis = Matrix(tuple(tuple(matrix[row][col] / lengths[col] for col in range(3)) for row in range(3)))
    if basis.determinant() < 0 or any(abs(basis.col[a].dot(basis.col[b])) > 1e-5 for a,b in ((0,1),(1,2),(0,2))):
        if value.get('type') == 'capsule':
            raise ValueError('Capsule proxies require positive scale without shear: ' + obj.name)
        return mesh_collision(obj)
    corners = [Vector(corner) for corner in obj.bound_box]
    low = Vector(tuple(min(corner[n] for corner in corners) for n in range(3)))
    high = Vector(tuple(max(corner[n] for corner in corners) for n in range(3)))
    local_size = high-low
    size = [local_size.x*lengths[0], local_size.z*lengths[2], local_size.y*lengths[1]]
    if value.get('type') == 'capsule':
        axis = value['axis']
        radius = round(max(size[index] for index in range(3) if index != axis) / 2, 6)
        half = round(max(0, size[axis] / 2 - radius), 6)
        value.update(radius=radius, halfLength=half)
        size = [2 * (radius + (half if index == axis else 0)) for index in range(3)]
    value.update(position=rounded(game_point(obj.matrix_world @ ((low+high)*.5))), size=rounded(size))
    rotation = three_euler(C.transposed() @ basis @ C)
    if max(abs(angle) for angle in rotation) > 1e-7:
        value['rotation'] = rotation
    else:
        value.pop('rotation', None)
    if min(size) < .01 or max(size) > 2000:
        raise ValueError('Collider dimensions must be 0.01–2,000 metres: ' + obj.name)
    return value


def read_collisions(package):
    objects = [obj for obj in bpy.context.scene.objects if is_collider(obj)]
    if not objects:
        path = package / 'collision.json'
        return validate_collisions(read_json(path) if path.exists() else read_json(package / 'map.json').get('colliders', []))
    for obj in objects:
        if obj.get('collisionType','box') not in ('box','mesh'):
            raise ValueError('Collider needs collisionType box or mesh: '+obj.name)
    return validate_collisions([mesh_collision(obj) if obj.get('collisionType') == 'mesh' else box_collision(obj) for obj in objects])


def marker_pose(obj):
    matrix = obj.matrix_world
    scales = [matrix.to_3x3().col[index].length for index in range(3)]
    if not all(math.isfinite(n) for row in matrix for n in row) or min(scales) < 1e-8 or matrix.to_3x3().determinant() <= 0:
        raise ValueError('Marker needs positive scale: ' + obj.name)
    up = matrix.to_3x3().col[2].normalized()
    if up.dot(Vector((0,0,1))) < .99999:
        raise ValueError('Gate/spawn supports yaw only; rotate around Blender Z: ' + obj.name)
    forward = game_point(matrix.to_3x3() @ Vector((0,-1,0)))
    position, yaw = rounded(game_point(matrix.translation)), round(math.atan2(forward.x,forward.z), 6)
    if not finite_vector(position) or not math.isfinite(yaw):
        raise ValueError('Marker needs a finite position and heading: '+obj.name)
    return position, yaw, scales


def read_routes(map_id):
    gates = [obj for obj in bpy.context.scene.objects if obj.get('flightGate')]
    spawns = [obj for obj in bpy.context.scene.objects if obj.get('flightSpawn')]
    if not gates and not spawns:
        return []
    races = map_races(map_id)
    known = {race['id'] for _,race in races}
    for obj in gates+spawns:
        if obj.get('track') not in known:
            raise ValueError('Marker references an unknown course: ' + obj.name)
    updates = []
    for path, race in races:
        selected = [obj for obj in gates if obj.get('track') == race['id']]
        orders = [obj.get('order') for obj in selected]
        if not all(isinstance(order,int) and not isinstance(order,bool) for order in orders) or sorted(orders) != list(range(len(race['gates']))):
            raise ValueError('Keep one marker per existing gate and its zero-based order: ' + race['id'])
        result = dict(race)
        result['gates'] = []
        for obj in sorted(selected, key=lambda obj:obj['order']):
            gate = dict(race['gates'][obj['order']])
            position, yaw, scale = marker_pose(obj)
            width, height = float(obj['width'])*scale[0], float(obj['height'])*scale[2]
            if not (.3 <= width <= 100 and .3 <= height <= 100):
                raise ValueError('Gate opening must be 0.3–100 metres: ' + obj.name)
            gate.update(position=position, yaw=yaw, width=round(width,6), height=round(height,6),
                        gateClass=obj.get('gateClass', gate.get('gateClass','open')),
                        frameThickness=float(obj.get('frameThickness',gate.get('frameThickness',.16))),
                        support={**gate.get('support',{}), 'type':obj.get('supportType','ground'), 'baseY':float(obj.get('supportBaseY',0))})
            if gate['gateClass'] not in ('precision-5','sport-7','open') or not (.05 <= gate['frameThickness'] <= .25):
                raise ValueError('Invalid gate class/frame thickness: ' + obj.name)
            if gate['support']['type'] not in ('ground','roof','suspended','none'):
                raise ValueError('Invalid gate support: ' + obj.name)
            support, base = gate['support']['type'], gate['support']['baseY']
            if not math.isfinite(base) or not -2000 <= base <= 2000:
                raise ValueError('Support anchor needs a finite height between -2,000 and 2,000 metres: '+obj.name)
            if support in ('ground','roof') and base > position[1]-height/2+1e-6:
                raise ValueError('Gate support must anchor at or below the opening: '+obj.name)
            if support == 'suspended' and base < position[1]+height/2+gate['frameThickness']-1e-6:
                raise ValueError('Suspended gate anchor must be above its upper frame: '+obj.name)
            result['gates'].append(gate)
        starts = [obj for obj in spawns if obj.get('track') == race['id']]
        if len(starts) != (1 if race.get('spawn') else 0):
            raise ValueError('Keep the original course spawn marker: ' + race['id'])
        if starts:
            position, yaw, _ = marker_pose(starts[0])
            result['spawn'] = {**race['spawn'], 'position':position, 'yaw':yaw}
        updates.append((path,result))
    return updates


def export_runtime(path):
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from runtime_export import export_material_batches
    return export_material_batches(path, is_authoring)

def backup_files(package, paths):
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
    backup = ROOT / 'data' / 'blender-backups' / (stamp+'-'+package.name)
    for path in paths:
        if path.exists():
            destination = backup / path.relative_to(ROOT)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)
    print('BACKUP ' + str(backup), flush=True)
    return backup


def process_package(package, args):
    definition = read_json(package / 'map.json')
    map_id = definition['id']
    source = args.source or package / 'map.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
    bpy.context.preferences.filepaths.save_version = 0
    if bpy.context.scene.get('map_id',map_id) != map_id:
        raise ValueError('Saved scene map_id does not match the destination package: '+map_id)
    if args.markers:
        backup_files(package,[package/'map.blend'])
        count = add_routes(map_id)
        proxies = add_collision_proxies(package, args.refresh_colliders)
        bpy.ops.wm.save_as_mainfile(filepath=str(package/'map.blend'))
        print('MARKERS '+json.dumps({'map':map_id,'gates':count,'proxies':proxies}), flush=True)
    if args.publish:
        if definition.get('modelTransform'):
            raise ValueError('Bake modelTransform into the Blender source and remove it before publishing to avoid double transforms.')
        collisions = read_collisions(package)
        routes = read_routes(map_id)
        with working_directory() as work:
            staging = Path(work)
            export_runtime(staging/'model.glb')
            write_json(staging/'collision.json',collisions)
            changed = [package/'model.glb',package/'collision.json',package/'map.json']+[path for path,_ in routes]
            backup_files(package,changed)
            definition.update(model='model.glb',collisionFile='collision.json',colliders=[],theme='custom')
            (staging/'model.glb').replace(package/'model.glb')
            (staging/'collision.json').replace(package/'collision.json')
            write_json(package/'map.json',definition)
            for path,race in routes:
                write_json(path,race)
        print('PUBLISHED '+json.dumps({'map':map_id,'colliders':len(collisions),'courses':len(routes)}),flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--map',dest='map_id')
    parser.add_argument('--all',action='store_true')
    parser.add_argument('--source',type=Path,help='Optional saved .blend source for one existing package')
    parser.add_argument('--markers',action='store_true',help='Rebuild course markers from JSON; seed missing collision proxies')
    parser.add_argument('--refresh-colliders',action='store_true',help='Explicitly replace edited native proxies with collision.json')
    parser.add_argument('--publish',action='store_true',help='Publish saved source geometry, collision and marker poses')
    argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    args = parser.parse_args(argv)
    if args.all == bool(args.map_id) or not (args.markers or args.publish):
        parser.error('Choose exactly one --map ID or --all, and --markers or --publish.')
    if args.source and (args.all or not args.source.is_file() or args.source.suffix.lower() != '.blend'):
        parser.error('--source needs one --map and an existing .blend file.')
    if args.refresh_colliders and not args.markers:
        parser.error('--refresh-colliders requires --markers.')
    packages = sorted(MAP_ROOT.glob('*/map.json')) if args.all else [MAP_ROOT/args.map_id/'map.json']
    for definition in packages:
        approved_junction=False
        import os
        profile_file=os.environ.get('CONTENT_IMPORT_PROFILE')
        if profile_file:
            profile=read_json(Path(profile_file))
            approved=profile.get('contentLocation')
            approved_junction=bool(approved and definition.parent.name==profile.get('id') and definition.parent.resolve()==Path(approved).resolve())
        if (not definition.resolve().is_relative_to(MAP_ROOT.resolve()) and not approved_junction) or not definition.is_file() or not (args.source or definition.parent/'map.blend').is_file():
            raise ValueError('Map needs canonical map.json and saved map.blend: '+str(definition.parent))
    (ROOT/'data').mkdir(exist_ok=True)
    for definition in packages:
        process_package(definition.parent,args)


if __name__ == '__main__':
    main()
