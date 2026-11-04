import bpy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
report=[]
for identifier in ['minus-two-demo','hangar-c03-demo','liftoff-arena-demo']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'content/maps'/identifier/'map.blend'))
 matches=[]
 for obj in bpy.context.scene.objects:
  if obj.type!='MESH':continue
  names=[obj.name]+[m.name for m in obj.data.materials if m]
  if any(any(word.lower() in n.lower() for word in ['PlayerDummy','DroneDummy','PowerBox','CombinedCharacter']) for n in names):
   matches.append({'name':obj.name,'materials':names[1:],'hidden':obj.hide_render,'vertices':len(obj.data.vertices)})
 report.append({'map':identifier,'markers':matches})
(ROOT/'data/scene-cleanup-source-inventory-20261013.json').write_text(json.dumps(report,indent=2))
print('SOURCE_MARKERS',json.dumps([{ 'map':r['map'],'count':len(r['markers'])} for r in report]),flush=True)
