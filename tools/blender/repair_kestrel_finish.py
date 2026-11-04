import bpy, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from neutral_kestrel_finish import neutralize_finish
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"data/menu-qa/kestrel-finish"
bpy.ops.wm.open_mainfile(filepath=str(ROOT/"data/menu-qa/before-polish/kestrel/kestrel.blend"))
bpy.context.preferences.filepaths.save_version=0
report=neutralize_finish(OUT)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"content/drones/kestrel/kestrel.blend"),compress=True)
(OUT/"finish.json").write_text(json.dumps(report,indent=2),encoding="utf8")
print("Neutral tint preparation:",len(report),"authored meshes",flush=True)
