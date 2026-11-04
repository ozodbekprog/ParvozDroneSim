"""Repair coordinate conventions in existing authored sources; create no meshes."""
import bpy,json,math,shutil
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/art-repair-20261013';OUT.mkdir(parents=True,exist_ok=True)
def backup(path):
 target=OUT/'before'/path.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():shutil.copy2(path,target)
def fix_uv(scene):
 if scene.get('liftoff_uv_convention_v2'):return
 seen=set()
 for o in scene.objects:
  if o.type!='MESH' or o.data in seen:continue
  seen.add(o.data)
  for uv in o.data.uv_layers:
   values=np.empty(len(uv.data)*2,dtype=np.float32);uv.data.foreach_get('uv',values);values[1::2]=1-values[1::2];uv.data.foreach_set('uv',values)
 scene['liftoff_uv_convention_v2']=True
config=json.loads((ROOT/'data/liftoff-drone-recovery/gate-prefab-config.json').read_text())
for identifier,frame in [('luma-5','Luma5Frame01'),('armattan-chameleon','ArmattanChameleonFrame01')]:
 folder=ROOT/'content/drones'/identifier;source=folder/(identifier+'.blend');backup(source)
 for label in ['hangar','low','far']:
  for suffix in ['.glb','-delivery.glb']:backup(folder/(label+suffix))
 bpy.ops.wm.open_mainfile(filepath=str(source));fix_uv(bpy.context.scene)
 native=next(r['data']['m_Structure'] for r in config['records'].values() if r['type']=='MonoBehaviour' and r['data'].get('m_Structure',{}).get('id')==frame)
 if str(native.get('batteryAtBottom'))=='1' and not bpy.context.scene.get('battery_native_bottom_v2'):
  body=bpy.data.objects.get('Frame_'+frame+'_0')
  battery=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('Battery_')]
  # Honor the source runtime flag instead of the editor's saved top-battery pose.
  floor=min((body.matrix_world@Vector(p)).z for p in body.bound_box)
  ceiling=max((o.matrix_world@Vector(p)).z for o in battery for p in o.bound_box)
  shift=floor-.002-ceiling
  for o in battery:o.location.z+=shift
  bpy.data.objects['mount_battery'].location.z+=shift
  bpy.context.scene['battery_native_bottom_v2']=True
  print('BATTERY_BOTTOM',identifier,shift,flush=True)
 bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(source))
 bpy.ops.export_scene.gltf(filepath=str(folder/'model.glb'),export_format='GLB',export_yup=True,export_extras=True)
# The source SCOUT axes point its motor bells down. Rotate about forward, while
# mirroring local rotor positions so physical telemetry indices retain their side.
folder=ROOT/'content/drones/kestrel';source=folder/'kestrel.blend';backup(source)
for label in ['hangar','low','far']:backup(folder/(label+'.glb'))
bpy.ops.wm.open_mainfile(filepath=str(source));root=bpy.data.objects['Kestrel']
if not root.get('upright_normalization_v2'):
 root.rotation_euler.y=math.pi
 for o in root.children:
  if o.name.startswith(('Rotor_','Motors_Default_','Mount_motors_','Mount_propellers_')):o.location.x=-o.location.x
 root['upright_normalization_v2']=True
bpy.ops.wm.save_as_mainfile(filepath=str(source))
originals={o:o.data for scene in bpy.data.scenes for o in scene.objects if o.type=='MESH'}
ratios=[('hangar',{'frame':.92,'camera':.92,'battery':.92,'motors':.92,'propellers':.92}),('low',{'frame':.17,'camera':.55,'battery':.3,'motors':.55,'propellers':.35}),('far',{'frame':.035,'camera':.15,'battery':.08,'motors':.12,'propellers':.06})]
destination=OUT/'kestrel';destination.mkdir(exist_ok=True)
main=root.users_scene[0]
for label,ratio in ratios:
 for o,data in originals.items():
  o.data=data.copy()
  if 'decal' not in o.name.lower():
   bpy.context.window.scene=o.users_scene[0];bpy.context.view_layer.objects.active=o
   modifier=o.modifiers.new('Verified delivery reduction','DECIMATE');modifier.ratio=ratio[o.get('part_category','frame')];bpy.ops.object.modifier_apply(modifier=modifier.name)
 bpy.context.window.scene=main
 bpy.ops.export_scene.gltf(filepath=str(destination/(label+'.raw.glb')),export_format='GLB',export_yup=True,use_active_scene=False,export_animations=False)
 for o,data in originals.items():reduced=o.data;o.data=data;bpy.data.meshes.remove(reduced)
# Correct only the workshop kit, leaving environment-map UVs untouched.
source=ROOT/'content/shared-assets/liftoff-workbench/map.blend';backup(source)
backup(ROOT/'content/shared-assets/liftoff-workbench/delivery.glb.prepared.glb')
bpy.ops.wm.open_mainfile(filepath=str(source));fix_uv(bpy.context.scene);bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('SOURCE_REPAIR_COMPLETE',flush=True)
