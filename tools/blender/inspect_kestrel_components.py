"""Diagnostic renders of actual authored disconnected components for semantic review."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/art-build/kestrel/components'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'content/review/kestrel/kestrel.blend'),load_ui=False,use_scripts=False)
body=bpy.data.objects['Scout_Scout_0']
for obj in list(bpy.context.scene.objects):
    if obj!=body:bpy.data.objects.remove(obj,do_unlink=True)
body.parent=None
inspection=body.copy();inspection.data=body.data.copy();bpy.context.scene.collection.objects.link(inspection)
bpy.ops.object.select_all(action='DESELECT');inspection.select_set(True);bpy.context.view_layer.objects.active=inspection
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
parts=list(bpy.context.selected_objects)
bpy.data.objects.remove(body,do_unlink=True)
camera_ids={121,122,123,124,235}
battery_ids={64,117,126,207,209,210,222}
materials={}
for category,color in [('camera',(1,.06,.03,1)),('battery',(.05,.3,1,1)),('frame',(.4,.5,.45,1))]:
    mat=bpy.data.materials.new('Diagnostic '+category);mat.diffuse_color=color;mat.use_nodes=True
    bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Base Color'].default_value=color
    materials[category]=mat
for obj in parts:
    index=int(obj.name.split('.')[-1]) if '.' in obj.name else 0
    category='camera' if index in camera_ids else 'battery' if index in battery_ids else 'frame'
    obj.data.materials.clear();obj.data.materials.append(materials[category])
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.world=bpy.data.worlds.new('Diagnostic world');scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Color'].default_value=(.4,.4,.4,1)
scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
camera=bpy.data.objects.new('Inspection camera',bpy.data.cameras.new('Inspection camera'));scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=.24
for label,position in [('front',(-.24,-.23,.16)),('reverse',(.24,.21,.13)),('side',(-.23,0,.075)),('top',(0,0,.4))]:
    camera.location=position;camera.rotation_euler=(Vector((0,0,.015))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(label+'.png'));bpy.ops.render.render(write_still=True)
print('SEMANTIC_COMPONENT_RENDERS',OUT,flush=True)
