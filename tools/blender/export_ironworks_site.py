"""Re-export the saved, packed full-site Blender source without rebuilding it."""
import bpy,bmesh,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from ironworks_chunks import export_site
from site_ground import partition_ground
root=Path(__file__).resolve().parents[2]
out=Path(os.environ['IRONWORKS_OUTPUT_DIR'])
bpy.ops.wm.open_mainfile(filepath=str(out/'map.blend'),load_ui=False,use_scripts=False)
collection=next(c for c in bpy.context.scene.collection.children if c.name.startswith('Ironworks'))
partition_ground(collection)
for obj in collection.objects:
    if obj.type=='MESH' and obj.name.startswith('Warehouse roof') and 'gable' in obj.name:
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.normal_update();bm.to_mesh(obj.data);bm.free();obj.data.validate();obj.data.update()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'map.blend'),compress=True)
delivery=export_site(out,collection)
definition=json.loads((root/'content/maps/ironworks-v2/map.json').read_text(encoding='utf8'))
definition.update(delivery)
definition.update({'name':'Ironworks — Industrial Site','description':'A 300 x 240 m industrial site: foundry, rail loading hall, maintenance depot, control tower, elevated pipe yard and open western flight field. The original courtyard is one small section.','bounds':{'min':[-150,-.04,-120],'max':[150,100,120]},'siteSizeMetres':[300,240],'zones':json.loads(bpy.context.scene['site_zones'])})
(out/'map-definition.json').write_text(json.dumps(definition,indent=2),encoding='utf8')
