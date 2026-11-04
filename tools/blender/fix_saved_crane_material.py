import bpy,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from ironworks_site import repair_crane_material
root=Path(__file__).resolve().parents[2]
out=Path(os.environ['IRONWORKS_OUTPUT_DIR'])
bpy.ops.wm.open_mainfile(filepath=str(out/'map.blend'),load_ui=False,use_scripts=False)
repair_crane_material(root)
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'map.blend'),compress=True)
