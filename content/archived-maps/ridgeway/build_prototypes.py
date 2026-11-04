"""Generate four original, low-poly FPV prototype maps and their game definitions.

Run from the repository root: python content/maps/ridgeway/build_prototypes.py
The GLBs use only glTF primitives and flat colors; no external assets are needed.
"""
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTENT = ROOT / "content"


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


class Scene:
    def __init__(self):
        self.nodes = []
        self.meshes = []
        self.materials = []
        self.accessors = []
        self.views = []
        self.binary = bytearray()
        self.mesh_cache = {}

    def accessor(self, values, component, kind):
        while len(self.binary) % 4:
            self.binary.append(0)
        offset = len(self.binary)
        if component == 5126:
            self.binary.extend(struct.pack("<" + "f" * len(values), *values))
            width = 4
        else:
            self.binary.extend(struct.pack("<" + "H" * len(values), *values))
            width = 2
        view = len(self.views)
        self.views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(values) * width})
        item = {"bufferView": view, "componentType": component, "count": len(values) // (3 if kind == "VEC3" else 1), "type": kind}
        if kind == "VEC3":
            item["min"] = [min(values[i::3]) for i in range(3)]
            item["max"] = [max(values[i::3]) for i in range(3)]
        index = len(self.accessors)
        self.accessors.append(item)
        return index

    def mesh(self, shape, color):
        key = (shape, color)
        if key in self.mesh_cache:
            return self.mesh_cache[key]
        if shape == "box":
            p = [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5,
                 -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5]
            ix = [0,2,1,0,3,2, 4,5,6,4,6,7, 0,1,5,0,5,4,
                  1,2,6,1,6,5, 2,3,7,2,7,6, 3,0,4,3,4,7]
        elif shape == "pyramid":
            p = [-.5,0,-.5, .5,0,-.5, .5,0,.5, -.5,0,.5, 0,1,0]
            ix = [0,1,4,1,2,4,2,3,4,3,0,4,0,3,2,0,2,1]
        else:
            raise ValueError(shape)
        rgba = [int(color[i:i+2], 16) / 255 for i in (1,3,5)] + [1]
        mat = len(self.materials)
        self.materials.append({"name": color, "pbrMetallicRoughness": {"baseColorFactor": rgba, "metallicFactor": 0, "roughnessFactor": 1}, "doubleSided": True})
        mesh = len(self.meshes)
        self.meshes.append({"primitives": [{"attributes": {"POSITION": self.accessor(p, 5126, "VEC3")}, "indices": self.accessor(ix, 5123, "SCALAR"), "material": mat}]})
        self.mesh_cache[key] = mesh
        return mesh

    def add(self, name, shape, color, x, y, z, sx, sy, sz, yaw=0):
        node = {"name": name, "mesh": self.mesh(shape, color), "translation": [x,y,z], "scale": [sx,sy,sz]}
        if yaw:
            node["rotation"] = [0, math.sin(yaw/2), 0, math.cos(yaw/2)]
        self.nodes.append(node)

    def write(self, path):
        data = {"asset": {"version": "2.0", "generator": "DroneLiftoffUz prototype builder"}, "scene": 0,
                "scenes": [{"nodes": list(range(len(self.nodes)))}], "nodes": self.nodes,
                "meshes": self.meshes, "materials": self.materials,
                "accessors": self.accessors, "bufferViews": self.views,
                "buffers": [{"byteLength": len(self.binary)}]}
        header = json.dumps(data, separators=(",", ":")).encode()
        header += b" " * (-len(header) % 4)
        binary = bytes(self.binary) + b"\0" * (-len(self.binary) % 4)
        path.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(header) + 8 + len(binary)) +
                         struct.pack("<I4s", len(header), b"JSON") + header +
                         struct.pack("<I4s", len(binary), b"BIN\0") + binary)


def box(scene, colliders, name, color, x, z, sx, sy, sz, bottom=0, yaw=0, solid=True):
    scene.add(name, "box", color, x, bottom + sy/2, z, sx, sy, sz, yaw)
    if solid:
        colliders.append({"position": [x, bottom + sy/2, z], "size": [sx, sy, sz]})


def tree(scene, colliders, name, x, z, height=12):
    box(scene, colliders, name + " trunk", "#65503c", x, z, 1.5, height*.45, 1.5)
    scene.add(name + " crown", "pyramid", "#47735d", x, height*.34, z, 8, height*.75, 8)


def route(points, name, map_id, laps=1, width=9, height=7):
    gates = []
    for i, (x, y, z) in enumerate(points):
        px, _, pz = points[i - 1]
        nx, _, nz = points[(i + 1) % len(points)]
        gates.append({"position": [x,y,z], "yaw": math.atan2(nx-px,nz-pz), "width": width, "height": height})
    first = points[0]
    yaw = gates[0]["yaw"]
    return {"id": name, "name": name.replace("-", " ").title(), "map": map_id,
            "laps": laps, "spawn": {"position": [round(first[0]-math.sin(yaw)*12,2), first[1], round(first[2]-math.cos(yaw)*12,2)], "yaw": yaw}, "gates": gates}


def segment_box_clearance(start, end, box):
    """Exact shortest distance from a segment to an axis-aligned collision box."""
    lower = [p - s / 2 for p, s in zip(box["position"], box["size"])]
    upper = [p + s / 2 for p, s in zip(box["position"], box["size"])]
    delta = [b - a for a, b in zip(start, end)]
    cuts = {0.0, 1.0}
    for axis in range(3):
        if abs(delta[axis]) < 1e-12:
            continue
        for boundary in (lower[axis], upper[axis]):
            t = (boundary - start[axis]) / delta[axis]
            if 0 < t < 1:
                cuts.add(t)
    cuts = sorted(cuts)
    minimum = float("inf")
    for left, right in zip(cuts, cuts[1:]):
        midpoint = (left + right) / 2
        terms = []
        for axis in range(3):
            position = start[axis] + delta[axis] * midpoint
            bound = lower[axis] if position < lower[axis] else upper[axis] if position > upper[axis] else None
            if bound is not None:
                terms.append((delta[axis], start[axis] - bound))
        denominator = sum(a*a for a, _ in terms)
        optimum = -sum(a*b for a, b in terms) / denominator if denominator else midpoint
        t = max(left, min(right, optimum))
        minimum = min(minimum, math.sqrt(sum((a*t+b)**2 for a, b in terms)))
    return minimum


def validate_route_clearance(race, colliders, margin=.4):
    gates = race["gates"]
    points = [race["spawn"]["position"]] + [gate["position"] for gate in gates] + [gates[0]["position"]]
    minimum = float("inf")
    for segment, (start, end) in enumerate(zip(points, points[1:])):
        for collider in colliders:
            distance = segment_box_clearance(start, end, collider)
            minimum = min(minimum, distance)
            if distance < margin - 1e-8:
                raise ValueError(f'{race["id"]} segment {segment} passes {distance:.3f} m from a collider')
        gate = gates[segment % len(gates)]
        normal = (math.sin(gate["yaw"]), math.cos(gate["yaw"]))
        before = sum((start[axis] - gate["position"][axis]) * normal[i] for i, axis in enumerate((0, 2)))
        after = sum((end[axis] - gate["position"][axis]) * normal[i] for i, axis in enumerate((0, 2)))
        if not (before < -1e-6 and after >= -1e-6):
            raise ValueError(f'{race["id"]} segment {segment} approaches gate {segment % len(gates)} backward')
    # Race resets start just beyond the preceding gate, so inspect those short
    # offset approaches as well as the ideal centerline.
    for index, gate in enumerate(gates):
        checkpoint = [gate["position"][0] + 1.3 * math.sin(gate["yaw"]),
                      gate["position"][1],
                      gate["position"][2] + 1.3 * math.cos(gate["yaw"])]
        destination = gates[(index + 1) % len(gates)]["position"]
        for collider in colliders:
            distance = segment_box_clearance(checkpoint, destination, collider)
            if distance < margin - 1e-8:
                raise ValueError(f'{race["id"]} checkpoint {index} passes {distance:.3f} m from a collider')
    return minimum


MAPS = {
  "ridgeway": {"name": "Ridgeway Pass", "region": "Highland Service Road", "theme": "custom", "sky": "#9bc2d4", "fog": "#a9bdc3", "ground": "#727d65", "sun": "#ffedc3", "sunPosition": [60,75,-30], "wind": [1.2,0,.6],
    "description": "A switchback course over a mountain service road, with a bridge, shelter and ridgeline pylons."},
  "sunscar": {"name": "Sunscar Flats", "region": "Desert Solar Array", "theme": "custom", "sky": "#e7b77f", "fog": "#cfab82", "ground": "#a7835d", "sun": "#fff1c9", "sunPosition": [-60,72,15], "wind": [1.6,0,-.4],
    "description": "A broad desert test site with solar rows, rock mesas and a dry canal crossing."},
  "nightgrid": {"name": "Nightgrid", "region": "Rainy City Blocks", "theme": "custom", "sky": "#29304d", "fog": "#353850", "ground": "#333943", "sun": "#a1b7df", "sunPosition": [35,65,40], "wind": [.4,0,.7],
    "description": "A dark street grid with illuminated tower silhouettes, transit stops and delivery vans."},
  "pinecrest": {"name": "Pinecrest Reserve", "region": "Forest Lookout", "theme": "custom", "sky": "#a2c9c1", "fog": "#a7c0b2", "ground": "#61785f", "sun": "#fff0c5", "sunPosition": [-35,85,-40], "wind": [.7,0,1.1],
    "description": "A wooded loop around a ranger station, fire tower and clear creek crossing."}
}


def scenery(map_id, scene, colliders):
    ground = MAPS[map_id]["ground"]
    box(scene, colliders, "ground blockout", ground, 0, 0, 240, .4, 240, bottom=-.4, solid=False)
    if map_id == "ridgeway":
        for i, (x,z,sx,sz,yaw) in enumerate([(-35,-31,90,9,.24),(26,-5,80,9,-.3),(-13,33,115,9,.18)]):
            box(scene, colliders, f"switchback {i}", "#565f57", x,z,sx,.08,sz,bottom=.01,yaw=yaw,solid=False)
        for i,(x,z,h) in enumerate([(-83,-73,17),(-76,27,22),(75,62,18),(83,-33,25)]):
            scene.add(f"ridge silhouette {i}", "pyramid", "#66746e", x,0,z,37,h,29)
        box(scene, colliders, "bridge deck", "#777770", 4,-12,20,1,9,bottom=2)
        box(scene, colliders, "shelter", "#7c8175", -58,36,13,7,12)
        for i,(x,z) in enumerate([(-51,-49),(48,36),(64,-27)]):
            box(scene, colliders, f"pylon {i}", "#b2aa8b", x,z,1.5,18,1.5)
    elif map_id == "sunscar":
        for i,(x,z) in enumerate([(-72,-57),(70,56),(-73,62),(71,-59)]):
            scene.add(f"mesa {i}", "pyramid", "#996e50", x,0,z,34,19,29)
        for i in range(4):
            for j in range(4):
                x,z=-34+i*15,-37+j*11
                box(scene,colliders,f"solar panel {i}-{j}","#416477",x,z,10,.25,5,bottom=3.5,solid=False)
                box(scene,colliders,f"solar post {i}-{j}","#68665f",x,z,1,3.5,1)
        box(scene,colliders,"control hut","#b7a282",56,30,13,6,11)
        box(scene,colliders,"dry canal bed","#795f4d",2,22,135,.05,8,bottom=.01,solid=False)
        box(scene,colliders,"canal crossing","#d4bd91",40,22,13,.2,13,bottom=.08,solid=False)
    elif map_id == "nightgrid":
        for i in range(-2,3):
            box(scene,colliders,f"street north {i}","#282d39",i*34,0,12,.04,180,bottom=.01,solid=False)
            box(scene,colliders,f"street east {i}","#282d39",0,i*34,180,.04,12,bottom=.01,solid=False)
        for i,(x,z,h) in enumerate([(-74,-70,28),(-73,-17,22),(-71,54,30),(-20,-70,23),(-20,-18,34),(-18,52,25),(53,-70,27),(55,-19,38),(55,54,30)]):
            box(scene,colliders,f"tower {i}","#485163",x,z,17,h,16)
            for level in range(2, int(h), 5):
                box(scene,colliders,f"tower light {i}-{level}","#83adbd",x,z+8.1,11,.35,.1,bottom=level,solid=False)
        for i,(x,z) in enumerate([(-45,7),(17,-45),(19,42)]):
            box(scene,colliders,f"delivery van {i}","#8b9194",x,z,6,3,11)
        box(scene,colliders,"transit shelter","#4b7987",-46,42,10,4,4)
    elif map_id == "pinecrest":
        for i,(x,z) in enumerate([(-67,-64),(-66,-34),(-65,12),(-68,58),(-37,-68),(-36,60),(3,-70),(6,66),(38,-68),(38,65),(72,-55),(72,-16),(73,22),(70,54)]):
            tree(scene,colliders,f"pine {i}",x,z,10+i%4*2)
        box(scene,colliders,"ranger station","#916c4c",-48,29,17,7,12)
        box(scene,colliders,"fire tower","#938e6b",49,45,5,21,5)
        box(scene,colliders,"fire platform","#aa8355",49,45,12,2,12,bottom=19)
        box(scene,colliders,"creek","#5f9396",5,-9,155,.04,9,bottom=.01,solid=False)
        box(scene,colliders,"creek bridge","#8d7957",28,-9,13,.4,13,bottom=.1,solid=False)


ROUTES = {
 "ridgeway": [
  ("ridgeway-switchback", [(-52,4,-32),(-13,5,-35),(31,6,-25),(57,5,2),(28,5,30),(-18,4,37),(-54,4,14)], 2),
  ("ridgeway-bridge-run", [(-43,4,-30),(-7,5,-17),(20,5,-12),(46,5,6),(21,4,30),(-25,4,34)], 1)],
 "sunscar": [
  ("sunscar-array-loop", [(-54,4,-44),(-15,4,-54),(34,5,-48),(59,5,-14),(38,4,40),(10,5,56),(-42,4,35),(-61,4,-5)], 2),
  ("sunscar-canal-dash", [(-55,4,1),(-30,4,20),(4,4,24),(40,4,22),(37,4,45),(22,4,57)], 1)],
 "nightgrid": [
  ("nightgrid-streetline", [(-45,4,-44),(-11,5,-45),(18,4,-45),(18,5,-9),(18,5,23),(-12,5,24),(-44,4,24),(-45,4,-11)], 2),
  ("nightgrid-rooftop", [(-45,9,-43),(-10,11,-44),(19,12,-44),(20,14,-10),(20,11,24),(-11,10,25),(-45,9,24)], 1)],
 "pinecrest": [
  ("pinecrest-canopy-loop", [(-48,4,-43),(-16,5,-51),(25,5,-46),(49,6,-24),(48,6,9),(27,5,39),(-13,4,47),(-47,4,8)], 2),
  ("pinecrest-creek-run", [(-47,4,-31),(-20,4,-19),(12,4,-9),(39,5,-7),(51,5,18),(29,4,39)], 1)]
}


MISSIONS = {
 "ridgeway": [
  ("ridgeway-first-ascent", "First Ascent", "ridgeway-switchback", 250, 180),
  ("ridgeway-bridge-precision", "Bridge Precision", "ridgeway-bridge-run", 125, 230),
  ("ridgeway-summit-shift", "Summit Shift", "ridgeway-switchback", 195, 300),
  ("ridgeway-return-line", "Return Line", "ridgeway-bridge-run", 105, 350)],
 "sunscar": [
  ("sunscar-array-survey", "Array Survey", "sunscar-array-loop", 270, 180),
  ("sunscar-canal-crossing", "Canal Crossing", "sunscar-canal-dash", 135, 230),
  ("sunscar-heat-run", "Heat Run", "sunscar-array-loop", 210, 310),
  ("sunscar-golden-hour", "Golden Hour", "sunscar-canal-dash", 115, 350)],
 "nightgrid": [
  ("nightgrid-courier", "Courier", "nightgrid-streetline", 260, 180),
  ("nightgrid-high-line", "High Line", "nightgrid-rooftop", 150, 240),
  ("nightgrid-afterhours", "Afterhours", "nightgrid-streetline", 205, 310),
  ("nightgrid-roof-relay", "Roof Relay", "nightgrid-rooftop", 125, 360)],
 "pinecrest": [
  ("pinecrest-ranger-patrol", "Ranger Patrol", "pinecrest-canopy-loop", 265, 180),
  ("pinecrest-creek-crossing", "Creek Crossing", "pinecrest-creek-run", 140, 230),
  ("pinecrest-lookout-line", "Lookout Line", "pinecrest-canopy-loop", 205, 310),
  ("pinecrest-forest-sprint", "Forest Sprint", "pinecrest-creek-run", 115, 350)]
}


HINTS = {
 "ridgeway": ["Follow the pale service road to the next bend.", "Use the bridge and shelter as turn markers; keep room from the pylons.", "On the return leg, set up wide before the downhill gate."],
 "sunscar": ["Use the dark solar rows to judge your heading.", "The canal and control hut mark the far side of the course.", "Stay above the panels and turn early around the mesas."],
 "nightgrid": ["Follow the lit street corridor through the first blocks.", "The transit shelter marks the return corner; watch the vans.", "For the high line, hold altitude above the street gates."],
 "pinecrest": ["Use the clear creek line as a visual anchor.", "Pass the ranger station with space for its roof and the nearby pines.", "Look for the fire tower before committing to the return turn."]
}


def render_thumbnail(scene, sky, path):
    """Render the actual GLB geometry; card previews never download full maps."""
    import numpy as np
    from PIL import Image
    width, height = 960, 540
    pixels = np.full((height, width, 3), [int(sky[i:i+2],16) for i in (1,3,5)], dtype=np.uint8)
    depth = np.full((height,width), -1e9)
    eye = np.array([.7,.95,1.0]); eye /= np.linalg.norm(eye)
    right = np.cross([0,1,0],eye);right /= np.linalg.norm(right);up = np.cross(eye,right)
    light = np.array([-.4,.9,.3]);light /= np.linalg.norm(light)
    def values(index):
        accessor=scene.accessors[index];view=scene.views[accessor['bufferView']]
        kind='<f4' if accessor['componentType']==5126 else '<u2'
        return np.frombuffer(scene.binary,dtype=kind,count=accessor['count']*(3 if accessor['type']=='VEC3' else 1),offset=view['byteOffset'])
    for node in scene.nodes:
        q=node.get('rotation',[0,0,0,1]);angle=2*math.atan2(q[1],q[3]);c,s=math.cos(angle),math.sin(angle)
        rotation=np.array([[c,0,s],[0,1,0],[-s,0,c]])
        for primitive in scene.meshes[node['mesh']]['primitives']:
            points=values(primitive['attributes']['POSITION']).reshape(-1,3)*np.array(node['scale'])
            points=points@rotation.T+np.array(node['translation'])
            triangles=values(primitive['indices']).reshape(-1,3)
            base=np.array(scene.materials[primitive['material']]['pbrMetallicRoughness']['baseColorFactor'][:3])*255
            for triangle in triangles:
                pts=points[triangle];normal=np.cross(pts[1]-pts[0],pts[2]-pts[0]);normal/=max(1e-9,np.linalg.norm(normal))
                if np.dot(normal,eye)<=0:normal=-normal
                color=np.clip(base*(.62+.38*max(0,np.dot(normal,light))),0,255).astype(np.uint8)
                xy=[(width/2+np.dot(p,right)*3.0,height*.55-np.dot(p,up)*3.0) for p in pts]
                x0=max(0,int(min(p[0] for p in xy)));x1=min(width-1,int(max(p[0] for p in xy))+1)
                y0=max(0,int(min(p[1] for p in xy)));y1=min(height-1,int(max(p[1] for p in xy))+1)
                if x1<x0 or y1<y0:continue
                (ax,ay),(bx,by),(cx,cy)=xy;den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
                if abs(den)<1e-9:continue
                yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
                wa=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/den;wb=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/den;wc=1-wa-wb
                zz=wa*np.dot(pts[0],eye)+wb*np.dot(pts[1],eye)+wc*np.dot(pts[2],eye)
                old=depth[y0:y1+1,x0:x1+1];mask=(wa>=0)&(wb>=0)&(wc>=0)&(zz>old)
                old[mask]=zz[mask];pixels[y0:y1+1,x0:x1+1][mask]=color
    Image.fromarray(pixels).resize((480,270),Image.Resampling.LANCZOS).save(path)


def main():
    for map_id, atmosphere in MAPS.items():
        folder = CONTENT / "maps" / map_id
        folder.mkdir(parents=True, exist_ok=True)
        scene, colliders = Scene(), []
        scenery(map_id, scene, colliders)
        scene.write(folder / "model.glb")
        try:
            render_thumbnail(scene, atmosphere['sky'], folder / 'thumbnail.png')
        except ImportError:
            print('Install NumPy and Pillow to regenerate map thumbnails.')
        save(folder / "map.json", {"id": map_id, **atmosphere, "seed": 800 + list(MAPS).index(map_id)*73,
             "cloudColor": atmosphere["fog"], "gravity": 1, "model": "model.glb",
             "colliders": colliders, "objects": []})
        by_name = {}
        for name, points, laps in ROUTES[map_id]:
            race = route(points, name, map_id, laps)
            clearance = validate_route_clearance(race, colliders)
            print(f'{name}: minimum centerline clearance {clearance:.2f} m')
            by_name[name] = race
            save(CONTENT / "races" / name / "race.json", race)
        for mission_id, title, track_name, target, reward in MISSIONS[map_id]:
            count = len(by_name[track_name]["gates"])
            hints = [{"afterGate": gate, "text": HINTS[map_id][i]}
                     for i, gate in enumerate([0, max(1,count//3), max(2,2*count//3)])]
            save(CONTENT / "challenges" / mission_id / "challenge.json",
                 {"id": mission_id, "name": title, "map": map_id, "track": track_name,
                  "target": target, "reward": reward, "hints": hints})
    for tutorial_id, map_id, track_name, name, text in [
        ("ridgeway-road-reading", "ridgeway", "ridgeway-bridge-run", "Reading the Road", "Use the pale switchback road as a guide and leave space around the pylons."),
        ("pinecrest-landmark-flight", "pinecrest", "pinecrest-creek-run", "Landmark Flight", "Use the creek, ranger station and fire tower to keep your bearings.")]:
        save(CONTENT / "tutorials" / tutorial_id / "tutorial.json",
             {"id": tutorial_id, "name": name, "map": map_id, "track": track_name,
              "steps": [{"text": text + " Select NEXT STEP when ready.", "objective": "manual", "target": 0, "duration": 0},
                        {"text": "Fly through the first gate in its forward direction.", "objective": "gate", "target": 0, "duration": 0},
                        {"text": "Keep the landmark in view and pass the second gate.", "objective": "gate", "target": 1, "duration": 0},
                        {"text": "Continue to the third gate and stabilize.", "objective": "gate", "target": 2, "duration": 0},
                        {"text": "Reduce speed and land clear of structures.", "objective": "land", "target": 0, "duration": 2}]})


if __name__ == "__main__":
    main()
