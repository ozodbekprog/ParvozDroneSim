"""Rebuild eleven official maps as editable Blender scenes and compact GLBs.

Run with Blender 5.1:
  blender --background --factory-startup --python tools/blender/rebuild_maps.py -- \
    --source-root data/content-spacious-20260930-230248/content

Stock GLBs are imported from export/editable/maps/<id>/model.glb. The four
prototype GLBs are imported from the immutable backup. The authoring manifest
records source hashes and coordinate scale to keep reruns idempotent.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MAPS = ('canyon', 'forest', 'hangar', 'industrial', 'neon', 'nightgrid',
        'orbital', 'pinecrest', 'ridgeway', 'ruins', 'sunscar')
PROTOTYPES = {'nightgrid', 'pinecrest', 'ridgeway', 'sunscar'}
INDOOR = {'hangar', 'orbital'}
SCALE_XZ = 2.0
SCALE_Y = 1.35

PALETTE = {
    'canyon': ('#bd8055', '#745447', '#dfad72', '#566b71', '#ebd39a'),
    'forest': ('#63826a', '#3e624f', '#947857', '#778f72', '#d2bc88'),
    'hangar': ('#8b989b', '#53636b', '#bbc8c6', '#d19d57', '#dce5dd'),
    'industrial': ('#69737a', '#43515a', '#a6a39a', '#ca9852', '#9cb5b9'),
    'neon': ('#343f55', '#222b3f', '#53687c', '#df5ba8', '#52bfd0'),
    'nightgrid': ('#3b4659', '#242d40', '#65748b', '#84b7c7', '#f4ba76'),
    'orbital': ('#758a9a', '#364d63', '#aebcc1', '#58beca', '#d7e4de'),
    'pinecrest': ('#64846b', '#426450', '#927653', '#6a9997', '#d6bd84'),
    'ridgeway': ('#7d8a77', '#56695f', '#a4a99a', '#d6b576', '#b4d0cf'),
    'ruins': ('#a89579', '#726655', '#c9b99a', '#8b9a79', '#f2deb0'),
    'sunscar': ('#be9567', '#9e7654', '#d9b583', '#526a78', '#f6d59c'),
}


def color(hexcode):
    rgb = [int(hexcode[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in rgb) + (1,)


def material(name, hexcode, metallic=0, emission=0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = color(hexcode)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = color(hexcode)
    principled.inputs['Metallic'].default_value = metallic
    principled.inputs['Roughness'].default_value = .82 if metallic == 0 else .52
    if emission:
        principled.inputs['Emission Color'].default_value = color(hexcode)
        principled.inputs['Emission Strength'].default_value = emission
    return mat


def save_json(path, data):
    path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


def runtime_point(x, y, z):
    """Game x/y/z (y up, z depth) to Blender x/y/z (z up)."""
    return (x, -z, y)


def unit_cube_mesh(mat=None):
    key = f'EDITABLE_UNIT_CUBE_{mat.name if mat else "COLLISION"}'
    existing = bpy.data.meshes.get(key)
    if existing:
        return existing
    mesh = bpy.data.meshes.new(key)
    vertices = [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),
                (-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
    faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    if mat:
        mesh.materials.append(mat)
    return mesh


def segment_distance(x, z, a, b):
    ax, az = a
    bx, bz = b
    vx, vz = bx - ax, bz - az
    t = max(0, min(1, ((x - ax) * vx + (z - az) * vz) / max(vx * vx + vz * vz, 1e-9)))
    return math.hypot(x - (ax + vx * t), z - (az + vz * t))


class Builder:
    def __init__(self, map_id, backup):
        self.id = map_id
        self.backup = backup
        self.rng = random.Random(6100 + MAPS.index(map_id))
        self.boxes = []
        self.mats = {}
        self.corridors = []
        self.current_collection = None
        self.palette = PALETTE[map_id]
        self._load_races()

    def _load_races(self):
        race_dir = self.backup / 'races'
        for folder in race_dir.iterdir():
            file = folder / 'race.json'
            if not file.exists():
                continue
            race = json.loads(file.read_text(encoding='utf-8'))
            if race.get('map') != self.id:
                continue
            points = [race['spawn']['position']] + [gate['position'] for gate in race['gates']]
            if race.get('laps', 1) > 1:
                points.append(race['gates'][0]['position'])
            for a, b in zip(points, points[1:]):
                self.corridors.append(((a[0] * SCALE_XZ, a[2] * SCALE_XZ),
                                       (b[0] * SCALE_XZ, b[2] * SCALE_XZ)))

    def clear(self, x, z, radius=12):
        return all(segment_distance(x, z, a, b) >= radius for a, b in self.corridors)

    def mat(self, slot, metallic=0, emission=0):
        key = (slot, metallic, emission)
        if key not in self.mats:
            self.mats[key] = material(f'{self.id}_{slot}_{metallic}_{emission}',
                                      self.palette[slot], metallic, emission)
        return self.mats[key]

    def pick(self, slot=0):
        return self.mat(slot)

    def collection(self, name):
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        self.current_collection = collection
        return collection

    def move_to_collection(self, obj):
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        self.current_collection.objects.link(obj)

    def collision(self, x, y, z, sx, sy, sz):
        self.boxes.append({'position': [round(x, 3), round(y, 3), round(z, 3)],
                           'size': [round(sx, 3), round(sy, 3), round(sz, 3)]})

    def box(self, name, x, y, z, sx, sy, sz, mat=0, solid=False, yaw=0, safe=False):
        if safe and not self.clear(x, z, max(sx, sz) * .65 + 12):
            return None
        obj = bpy.data.objects.new(name, unit_cube_mesh(self.pick(mat)))
        self.current_collection.objects.link(obj)
        obj.location = runtime_point(x, y, z)
        obj.scale = (sx, sz, sy)
        obj.rotation_euler.z = -yaw
        if solid:
            self.collision(x, y, z, sx, sy, sz)
        return obj

    def cylinder(self, name, x, y, z, radius, depth, mat=0, vertices=12, solid=False, safe=False):
        if safe and not self.clear(x, z, radius + 12):
            return None
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                            location=runtime_point(x, y, z))
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(self.pick(mat))
        self.move_to_collection(obj)
        if solid:
            self.collision(x, y, z, radius * 1.5, depth, radius * 1.5)
        return obj

    def cone(self, name, x, y, z, radius1, radius2, depth, mat=1, vertices=9):
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2,
                                        depth=depth, location=runtime_point(x, y, z))
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(self.pick(mat))
        self.move_to_collection(obj)
        return obj

    def ground(self, extent):
        self.collection('Terrain and Road Surfaces')
        self.box('Editable terrain plane', 0, -.20, 0, extent * 2, .38, extent * 2, 0)
        # Fine color bands make the large, flat training surface readable.
        for n in range(-2, 3):
            v = n * extent / 3
            self.box(f'Surface guide east {n}', 0, .002, v, extent * 1.7, .012, .22, 2)
            self.box(f'Surface guide north {n}', v, .002, 0, .22, .012, extent * 1.7, 2)

    def road(self, name, x, z, sx, sz, yaw=0, mat=1):
        self.box(name, x, .015, z, sx, .028, sz, mat, yaw=yaw)
        if sx > sz:
            for i in range(-int(sx // 24), int(sx // 24) + 1):
                self.box(f'{name} lane mark {i}', x + i * 12, .036, z, 5, .012, .32, 4, yaw=yaw)
        else:
            for i in range(-int(sz // 24), int(sz // 24) + 1):
                self.box(f'{name} lane mark {i}', x, .036, z + i * 12, .32, .012, 5, 4, yaw=yaw)

    def building(self, label, x, z, w, d, h, mat=1, open_side=None, floor=True):
        if not self.clear(x, z, max(w, d) * .72 + 14):
            return
        wall = 1.1
        if floor:
            self.box(f'{label} foundation', x, .28, z, w, .55, d, 2)
        self.collection_if_needed('Editable Architecture')
        for side, px, pz, sx, sz in [
            ('west', x-w/2, z, wall, d), ('east', x+w/2, z, wall, d),
            ('north', x, z-d/2, w, wall), ('south', x, z+d/2, w, wall)]:
            if side == open_side:
                # Door opening with frame gives a flyable interior.
                if sx > sz:
                    for dx in (-w*.38, w*.38):
                        self.box(f'{label} {side} door pier {dx}', x+dx, h*.45, pz, w*.24, h*.9, wall, mat, True)
                else:
                    for dz in (-d*.38, d*.38):
                        self.box(f'{label} {side} door pier {dz}', px, h*.45, z+dz, wall, h*.9, d*.24, mat, True)
                self.box(f'{label} {side} door lintel', px, h*.95, pz, sx, h*.1, sz, 2, True)
                continue
            self.box(f'{label} {side} wall', px, h/2, pz, sx, h, sz, mat, True)
        self.box(f'{label} roof edge', x, h+.38, z, w+2, .75, d+2, 2)
        for i in range(1, max(2, int(h // 5))):
            y = i * h / max(2, int(h // 5))
            self.box(f'{label} facade strip {i}', x, y, z-d/2-.06, w*.77, .65, .1, 4)
        self.box(f'{label} rooftop unit', x+w*.23, h+1.2, z, w*.18, 1.5, d*.2, 3)

    def collection_if_needed(self, name):
        if self.current_collection is None or self.current_collection.name != name:
            found = bpy.data.collections.get(name)
            self.current_collection = found or self.collection(name)

    def tree(self, label, x, z, height=16, evergreen=True):
        if not self.clear(x, z, 12):
            return
        self.collection_if_needed('Editable Vegetation')
        self.cylinder(f'{label} trunk', x, height*.22, z, .9, height*.44, 1, 8, True)
        if evergreen:
            for level in range(3):
                self.cone(f'{label} branch tier {level}', x, height*(.45+.17*level), z,
                          5.2-level*1.1, .35, height*.33, 1)
        else:
            self.cone(f'{label} broad crown', x, height*.69, z, 6.2, 3.3, height*.48, 0, 10)

    def tank(self, label, x, z, radius=8, height=14):
        if not self.clear(x, z, radius+14):
            return
        self.collection_if_needed('Editable Industrial Equipment')
        self.cylinder(f'{label} vessel', x, height/2, z, radius, height, 2, 16, True)
        self.cylinder(f'{label} cap', x, height+.55, z, radius+1, 1.1, 4, 16)
        for level in (height*.25, height*.72):
            self.cylinder(f'{label} safety band {level}', x, level, z, radius+.18, .3, 3, 16)

    def pipeline(self, label, x, z, length, y=8, along_x=True):
        self.collection_if_needed('Editable Industrial Equipment')
        self.box(f'{label} elevated pipe', x, y, z, length if along_x else 1.4,
                 1.4, 1.4 if along_x else length, 3)
        for offset in (-length*.37, 0, length*.37):
            px = x+offset if along_x else x
            pz = z if along_x else z+offset
            self.box(f'{label} pipe support {offset}', px, y/2, pz, 1, y, 1, 2, True)

    def street_tower(self, label, x, z, h, w=24, d=22):
        if not self.clear(x, z, max(w,d)*.72+15):
            return
        self.building(label, x, z, w, d, h, 1, open_side='south')
        self.collection_if_needed('Editable Facades and Windows')
        for level in range(5, int(h), 8):
            for offset in (-w*.27, w*.27):
                self.box(f'{label} window north {level} {offset}', x+offset, level, z-d/2-.12, w*.18, 2.2, .08, 3)
                self.box(f'{label} window south {level} {offset}', x+offset, level, z+d/2+.12, w*.18, 2.2, .08, 4)
        self.box(f'{label} rooftop beacon', x, h+2.8, z, 1.2, 4.5, 1.2, 4)

    def scenery(self):
        outer = 185 if self.id in INDOOR else 440
        self.ground(outer)
        if self.id in INDOOR:
            self.indoor(outer)
        elif self.id in {'forest', 'pinecrest'}:
            self.woodland(outer)
        elif self.id in {'neon', 'nightgrid'}:
            self.city(outer)
        elif self.id == 'industrial':
            self.industrial(outer)
        elif self.id in {'canyon', 'ridgeway', 'sunscar'}:
            self.highlands(outer)
        elif self.id == 'ruins':
            self.ruins(outer)

    def indoor(self, extent):
        self.collection('Editable Hangar and Station Shell')
        width, depth = extent*1.92, extent*1.86
        h = 34 if self.id == 'hangar' else 43
        self.box('North perimeter wall', 0, h/2, -depth/2, width, h, 2, 1, True)
        self.box('South perimeter wall', 0, h/2, depth/2, width, h, 2, 1, True)
        self.box('West perimeter wall', -width/2, h/2, 0, 2, h, depth, 1, True)
        self.box('East perimeter wall', width/2, h/2, 0, 2, h, depth, 1, True)
        for x in range(-140, 141, 35):
            self.box(f'Ceiling transverse beam {x}', x, h-1, 0, 1.6, 1.8, depth, 2)
            self.box(f'Wall light north {x}', x, 13, -depth/2+1.2, 12, 1.2, .25, 4)
            self.box(f'Wall light south {x}', x, 13, depth/2-1.2, 12, 1.2, .25, 4)
        for z in range(-120, 121, 40):
            self.box(f'Ceiling longitudinal beam {z}', 0, h-1, z, width, 1.4, 1.4, 2)
        self.box('High skylight strip', 0, h-.24, 0, width*.75, .25, depth*.18, 4)
        self.road('Flight axis marking', 0, 0, 6, depth*.8, mat=2)
        for i, (x,z) in enumerate([(-130,-90),(125,-88),(-130,90),(125,90)]):
            if self.id == 'hangar':
                self.building(f'Maintenance bay {i}', x, z, 34, 27, 12, 2, open_side='south')
            else:
                self.building(f'Equipment module {i}', x, z, 34, 30, 15, 2, open_side='south')
                self.cylinder(f'Module reactor {i}', x, 17, z, 5, 4, 3, 12)
        if self.id == 'hangar':
            for i, x in enumerate((-110, 110)):
                self.box(f'Gantry rail {i}', x, h-6, 0, 2.1, 1.1, depth*.7, 3)
        else:
            for i, z in enumerate((-77, 77)):
                self.box(f'Observation deck {i}', 0, 9, z, width*.43, 1.1, 9, 2)
                self.box(f'Observation rail {i}', 0, 11, z, width*.43, 2.5, .5, 4)

    def woodland(self, extent):
        self.collection('Editable Forest Floor')
        self.road('Ranger gravel road', -20, 12, extent*.73, 8, mat=2)
        self.box('Creek bed', 55, .005, -48, extent*.8, .02, 11, 3)
        for i in range(72):
            angle = i * 2.39996
            radius = 75 + (i % 11)*22 + self.rng.uniform(-9, 9)
            x, z = math.cos(angle)*radius, math.sin(angle)*radius
            self.tree(f'Pine grove {i:02d}', x, z, self.rng.uniform(13, 24), i % 5 != 0)
        for i, (x,z) in enumerate([(-130,135),(165,-145),(-185,-95)]):
            self.building(f'Ranger cabin {i}', x, z, 30, 23, 13, 1, open_side='south')
            self.box(f'Cabin chimney {i}', x+9, 17, z-5, 2.5, 11, 2.5, 2, True)
        self.box('Lookout tower legs', 190, 16, 130, 6, 32, 6, 2, True, safe=True)
        self.box('Lookout platform', 190, 33, 130, 21, 2, 21, 2)

    def city(self, extent):
        self.collection('Editable Street Grid')
        for index in range(-5,6):
            self.road(f'East-west street {index}', 0, index*68, extent*1.8, 15)
            self.road(f'North-south street {index}', index*68, 0, 15, extent*1.8)
        for i in range(-3,4):
            for j in range(-3,4):
                x, z = i*68+34, j*68+34
                h = 24 + ((i*13+j*7) % 7)*9
                self.street_tower(f'City block {i} {j}', x, z, h, 27, 26)
        for i,(x,z) in enumerate([(-320,-290),(-290,315),(310,-310),(325,290)]):
            self.street_tower(f'Peripheral landmark tower {i}',x,z,74+i*9,34,32)
        for i, (x,z) in enumerate([(-90,18),(95,-68),(130,95),(-155,-110)]):
            self.box(f'Transit van {i} body', x, 2, z, 7, 4, 12, 2, True, safe=True)
            self.box(f'Transit van {i} glass', x, 4.2, z+2, 6, .7, 4, 3)
        self.box('Open transit shelter roof', -125, 7, 65, 20, .8, 10, 4)
        for x in (-132,-118):
            self.box(f'Transit shelter support {x}', x, 3.5, 65, .7, 7, .7, 2, True, safe=True)

    def industrial(self, extent):
        self.collection('Editable Plant Roads')
        self.road('Freight spine', 0, 0, extent*.92, 18)
        self.road('Service spur', 0, 85, extent*.75, 12)
        for i, (x,z) in enumerate([(-190,-150),(180,-145),(-170,140),(170,140)]):
            self.building(f'Fabrication hall {i}', x, z, 62, 46, 30, 1, open_side='south')
            self.box(f'Hall vent {i}', x, 34, z, 10, 6, 11, 3)
        for i,(x,z) in enumerate([(-125,-90),(116,-95),(-125,110),(125,100)]):
            self.tank(f'Storage tank {i}', x, z, 11, 19)
        for i,(x,z) in enumerate([(-210,45),(210,30)]):
            self.pipeline(f'Pipe bank {i}', x, z, 65, 11)
            self.box(f'Crane mast {i}', x, 32, z+36, 5, 64, 5, 2, True, safe=True)
            self.box(f'Crane boom {i}', x+18, 61, z+36, 42, 3, 3, 3)

    def highlands(self, extent):
        self.collection('Editable Highland Surface')
        self.road('Long service track', 0, -15, extent*.75, 10)
        self.road('Crossing track', 32, 50, 10, extent*.53)
        for i in range(28):
            angle = i*2.39996
            radius = 150+(i%8)*35
            x,z = math.cos(angle)*radius,math.sin(angle)*radius
            if not self.clear(x,z,26):
                continue
            self.cone(f'Layered mesa {i} base',x,11,z,18+(i%3)*4,12,22,1,8)
            self.cone(f'Layered mesa {i} cap',x,24,z,12,4,9,2,8)
            self.collision(x, 11, z, 21, 22, 21)
        if self.id == 'sunscar':
            for i in range(8):
                for j in range(6):
                    x,z = -210+i*30, 120+j*20
                    if not self.clear(x,z,16):
                        continue
                    self.box(f'Solar row {i} {j} post',x,2.5,z,1.1,5,1.1,1,True)
                    self.box(f'Solar row {i} {j} panel',x,5.1,z,23,.35,11,3)
                    self.box(f'Solar row {i} {j} rim',x,5.35,z,24,.4,.5,4)
            self.building('Solar control depot',205,-155,45,32,17,2,open_side='south')
        else:
            self.building('Road service station',185,110,41,30,18,2,open_side='south')
            self.box('Highland bridge deck',90,4,85,56,2,16,2)
            for x in (65,115):
                self.box(f'Bridge pier {x}',x,2,85,3,4,3,1,True,safe=True)

    def ruins(self, extent):
        self.collection('Editable Ruins and Plazas')
        self.box('Central stone plaza',0,.03,0,190,.07,190,2)
        for row in range(-3,4):
            for col in range(-3,4):
                x,z = col*52,row*52
                if not self.clear(x,z,16):
                    continue
                height = 9 + ((row*7+col*11)%5)*2
                self.cylinder(f'Ruined colonnade {row} {col}',x,height/2,z,2.7,height,1,10,True)
                self.box(f'Ruined capital {row} {col}',x,height+.6,z,7,1.2,7,2)
        for i,(x,z) in enumerate([(-170,-145),(175,-150),(-170,160),(170,155)]):
            self.building(f'Open temple {i}',x,z,40,35,17,1,open_side='south')
        for i,(x,z) in enumerate([(0,-210),(-220,0),(225,50)]):
            if self.clear(x,z,19):
                self.box(f'Weathered obelisk {i}',x,14,z,7,28,7,1,True)


def source_glb(map_id, backup):
    if map_id in PROTOTYPES:
        file = backup / 'maps' / map_id / 'model.glb'
    else:
        file = ROOT / 'export' / 'editable' / 'maps' / map_id / 'model.glb'
    if not file.exists():
        raise FileNotFoundError(f'Original GLB for {map_id}: {file}')
    return file


def import_original(file, builder):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(file))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    root = bpy.data.objects.new(f'ORIGINAL_{builder.id}_scaled_XZ2_Y1p35', None)
    builder.collection('Imported Original Geometry')
    builder.current_collection.objects.link(root)
    root.scale = (SCALE_XZ, SCALE_XZ, SCALE_Y)
    for obj in imported:
        if obj.parent is None:
            obj.parent = root
        if authoring_helper(obj):
            obj.hide_render = True
    bpy.context.view_layer.update()
    retained = []
    for obj in imported:
        if obj.type == 'MESH' and not authoring_helper(obj):
            corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
            low = [min(point[axis] for point in corners) for axis in range(3)]
            high = [max(point[axis] for point in corners) for axis in range(3)]
            dx, dz, dy = high[0]-low[0], high[1]-low[1], high[2]-low[2]
            original_ground = dx > 500 and dz > 500 and dy < .7
            inner_wall = (builder.id in INDOOR and max(dx,dz) > 245 and min(dx,dz) < 7 and dy > 25)
            inner_roof = (builder.id in INDOOR and dx > 245 and dz > 220 and dy < 2 and low[2] > 20)
            if original_ground or inner_wall or inner_roof:
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
        retained.append(obj)
    return retained


def authoring_helper(obj):
    current = obj
    while current is not None:
        if re.match(r'^(?:COLLIDER[_-]|GATE[_-]|SPAWN$)', current.name, re.I):
            return True
        if current.get('flightCollider') or current.get('collider') or current.get('flightGate') or current.get('flightSpawn'):
            return True
        current = current.parent
    return False


def imported_collision_meshes(imported):
    """Keep exported low-poly authoring proxies as exact scaled triangles."""
    bpy.context.view_layer.update()
    result = []
    for obj in imported:
        if obj.type != 'MESH' or not (re.match(r'^COLLIDER[_-]', obj.name, re.I)
                                          or obj.get('flightCollider') or obj.get('collider')):
            continue
        triangles = []
        for polygon in obj.data.polygons:
            ids = list(polygon.vertices)
            for i in range(1, len(ids)-1):
                for vertex_index in (ids[0], ids[i], ids[i+1]):
                    point = obj.matrix_world @ obj.data.vertices[vertex_index].co
                    triangles.extend((round(point.x, 5), round(point.z, 5), round(-point.y, 5)))
        if triangles:
            result.append({'type':'mesh', 'vertices':triangles})
    return result


def imported_solid_boxes(imported, builder):
    """Conservative boxes for substantial visible structures outside race lines."""
    bpy.context.view_layer.update()
    result = []
    for obj in imported:
        if obj.type != 'MESH' or authoring_helper(obj):
            continue
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        low = [min(point[axis] for point in corners) for axis in range(3)]
        high = [max(point[axis] for point in corners) for axis in range(3)]
        sx, sy, sz = high[0]-low[0], high[2]-low[2], high[1]-low[1]
        if not (2.5 <= sx <= 110 and 2 <= sy <= 110 and 2.5 <= sz <= 110):
            continue
        x, y, z = (low[0]+high[0])/2, (low[2]+high[2])/2, -(low[1]+high[1])/2
        if not builder.clear(x, z, max(sx, sz)*.6 + 7):
            continue
        result.append({'position':[round(x,3),round(y,3),round(z,3)],
                       'size':[round(sx,3),round(sy,3),round(sz,3)]})
        if len(result) >= 300:
            break
    return result


def seed_collision_proxies(colliders):
    collection = bpy.data.collections.new('COLLISION_PROXIES')
    bpy.context.scene.collection.children.link(collection)
    for index, collider in enumerate(colliders):
        if collider.get('type') == 'mesh':
            coords = collider['vertices']
            vertices = [runtime_point(*coords[i:i+3]) for i in range(0,len(coords),3)]
            faces = [(i,i+1,i+2) for i in range(0,len(vertices),3)]
            mesh = bpy.data.meshes.new(f'Collision triangle mesh {index:03d}')
            mesh.from_pydata(vertices,[],faces)
            mesh.update()
            obj = bpy.data.objects.new(f'COLLIDER_{index:03d}',mesh)
            collection.objects.link(obj)
            obj['collisionType'] = 'mesh'
        else:
            x,y,z = collider['position']
            sx,sy,sz = collider['size']
            obj = bpy.data.objects.new(f'COLLIDER_{index:03d}',unit_cube_mesh())
            collection.objects.link(obj)
            obj.location = runtime_point(x,y,z)
            obj.scale = (sx,sz,sy)
            obj['collisionType'] = 'box'
        obj['flightCollider'] = True
        obj.display_type = 'WIRE'
        obj.hide_render = True


def remove_imported_helpers(imported):
    helpers = [obj for obj in imported if authoring_helper(obj)]
    for obj in reversed(helpers):
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj,do_unlink=True)


def export_runtime(path):
    collection = bpy.data.collections.new('RUNTIME_EXPORT_TEMP')
    bpy.context.scene.collection.children.link(collection)
    bpy.context.view_layer.update()
    export_objects = []
    generated = {}
    for original in list(bpy.data.objects):
        if original.type != 'MESH' or original.name.startswith('RUNTIME_') or authoring_helper(original):
            continue
        current = original.parent
        from_original = False
        while current is not None:
            if current.name.startswith('ORIGINAL_'):
                from_original = True
                break
            current = current.parent
        if from_original:
            duplicate = original.copy()
            duplicate.data = original.data.copy()
            collection.objects.link(duplicate)
            world = original.matrix_world.copy()
            duplicate.parent = None
            duplicate.matrix_world = world
            duplicate.name = 'RUNTIME_' + original.name
            export_objects.append(duplicate)
            continue
        mat = original.material_slots[0].material if original.material_slots else None
        key = mat.name if mat else 'unpainted'
        group = generated.setdefault(key, {'material':mat,'vertices':[],'faces':[]})
        offset = len(group['vertices'])
        transform = original.matrix_world
        group['vertices'].extend(tuple(transform @ vertex.co) for vertex in original.data.vertices)
        group['faces'].extend(tuple(offset+index for index in polygon.vertices) for polygon in original.data.polygons)
    for key,group in generated.items():
        mesh = bpy.data.meshes.new('RUNTIME_GROUP_' + key)
        mesh.from_pydata(group['vertices'],[],group['faces'])
        mesh.update()
        if group['material']:
            mesh.materials.append(group['material'])
        obj = bpy.data.objects.new('RUNTIME_GROUP_' + key,mesh)
        collection.objects.link(obj)
        export_objects.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in export_objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_extras=False,
                              export_cameras=False, export_lights=False)
    for obj in export_objects:
        bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(collection)


def render_thumbnail(path, builder):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 506
    scene.render.resolution_percentage = 100
    scene.eevee.taa_render_samples = 16
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(path)
    if scene.world is None:
        scene.world = bpy.data.worlds.new('Authoring sky')
    sky = color('#bcced1' if builder.id not in {'neon','nightgrid'} else '#57677f')
    scene.world.color = sky[:3]
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = sky
    background.inputs['Strength'].default_value = .85
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = .2
    indoor = builder.id in INDOOR
    camera_position = (110,-130,21) if indoor else (200,-255,230)
    camera_target = (0,0,5) if indoor else (0,0,0)
    bpy.ops.object.camera_add(location=camera_position)
    camera = bpy.context.object
    camera.name = 'Authoring thumbnail camera'
    camera.rotation_euler = (Vector(camera_target) - camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'PERSP' if indoor else 'ORTHO'
    if indoor:
        camera.data.lens = 27
    else:
        camera.data.ortho_scale = 400
    scene.camera = camera
    bpy.ops.object.light_add(type='SUN', location=(90,-100,180))
    sunlight = bpy.context.object
    sunlight.name = 'Authoring sunlight'
    sunlight.rotation_euler = (Vector((0,0,0)) - sunlight.location).to_track_quat('-Z','Y').to_euler()
    sunlight.data.energy = 1.8 if builder.id not in {'neon','nightgrid'} else 1.1
    bpy.ops.render.render(write_still=True)


def transform_colliders(colliders):
    result = []
    for old in colliders:
        if old.get('type') == 'mesh':
            vertices = old['vertices']
            if len(vertices) % 3:
                raise ValueError('Source triangle collider has incomplete coordinates')
            transformed = [value*(SCALE_Y if index%3 == 1 else SCALE_XZ)
                           for index,value in enumerate(vertices)]
            result.append({'type':'mesh','vertices':transformed})
            continue
        box = dict(old)
        box['position'] = [old['position'][0]*SCALE_XZ,old['position'][1]*SCALE_Y,old['position'][2]*SCALE_XZ]
        box['size'] = [old['size'][0]*SCALE_XZ,old['size'][1]*SCALE_Y,old['size'][2]*SCALE_XZ]
        result.append(box)
    return result


def rebuild(map_id, backup, output_root):
    target = output_root / map_id
    target.mkdir(parents=True, exist_ok=True)
    old = json.loads((backup / 'maps' / map_id / 'map.json').read_text(encoding='utf-8'))
    source = source_glb(map_id, backup)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    builder = Builder(map_id, backup)
    imported = import_original(source, builder)
    imported_proxies = imported_collision_meshes(imported)
    original_structure_boxes = imported_solid_boxes(imported,builder)
    remove_imported_helpers(imported)
    builder.scenery()
    current_file = target / 'map.json'
    current = json.loads(current_file.read_text(encoding='utf-8')) if current_file.exists() else dict(old)
    current.update({'model':'model.glb', 'collisionFile':'collision.json',
                    'theme':'custom', 'environment':old.get('environment',old.get('theme','custom')),
                    'groundPlane':False, 'indoor':map_id in INDOOR, 'fogDensity':.0014 if map_id not in INDOOR else .0005,
                    'colliders':[]})
    save_json(target / 'map.json', current)
    boxes = (imported_proxies if imported_proxies else transform_colliders(old.get('colliders',[]))) + original_structure_boxes + builder.boxes
    save_json(target / 'collision.json', boxes)
    seed_collision_proxies(boxes)
    save_json(target / 'authoring.json', {'version':1, 'source':str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
              'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'horizontalScale':SCALE_XZ,
              'verticalScale':SCALE_Y, 'originalTheme':old.get('theme'),
              'originalColliderCount':len(old.get('colliders',[])), 'generatedColliderCount':len(builder.boxes),
              'importedProxyMeshes':len(imported_proxies),
              'originalStructureBoxes':len(original_structure_boxes),
              'importedObjectCount':len(imported), 'editableObjectCount':sum(obj.type=='MESH' for obj in bpy.data.objects)})
    render_thumbnail(target / 'thumbnail.png', builder)
    bpy.ops.wm.save_as_mainfile(filepath=str(target / 'map.blend'))
    export_runtime(target / 'model.glb')
    print(f'REBUILT {map_id}: {len(imported)} imported, {len(builder.boxes)} new collision boxes, {len(bpy.data.objects)} editables')


def main():
    argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, default=ROOT / 'content' / 'maps')
    parser.add_argument('--maps', nargs='*', choices=MAPS, default=MAPS)
    args = parser.parse_args(argv)
    backup = args.source_root.resolve()
    output_root = args.output_root.resolve()
    for map_id in args.maps:
        rebuild(map_id, backup, output_root)


if __name__ == '__main__':
    main()
