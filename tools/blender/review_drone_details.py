"""Render additive Low source geometry against the retained aircraft source."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/drone-detail-20261015/review';OUT.mkdir(parents=True,exist_ok=True)
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for identifier in requested or ['luma-5','armattan-chameleon','armattan-gecko','dquad-addiction','kestrel']:
    folder=ROOT/'content/drones'/identifier
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if identifier=='kestrel':
        with bpy.data.libraries.load(str(folder/'kestrel.blend'),link=False) as (source,dest):dest.scenes=[name for name in source.scenes if name=='Kestrel assembled']
        scene=dest.scenes[0];bpy.context.window.scene=scene
        ratios={'frame':.17,'camera':.55,'battery':.3,'motors':.55,'propellers':.35}
        for obj in list(scene.objects):
            if obj.type=='MESH' and 'decal' not in obj.name.lower():
                obj.data=obj.data.copy()
                bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
                m=obj.modifiers.new('Low review','DECIMATE');m.ratio=ratios[obj.get('part_category','frame')];bpy.ops.object.modifier_apply(modifier=m.name)
    else:bpy.ops.import_scene.gltf(filepath=str(folder/'low.glb'))
    base=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'content/shared-assets/drone-details/low-source.glb'))
    details=set(bpy.context.scene.objects)-base
    sidecar=json.loads((folder/'details.json').read_text());definition=json.loads((folder/'drone.json').read_text());electrical=sidecar['visualDetails']
    battery_id=definition.get('stockParts',{}).get('battery');kept={electrical['frameNode'],electrical['batteryNodes'].get(battery_id),sidecar['accessories']['actionCamera']['modelNode']}
    for obj in list(details):
        root=obj
        while root.parent and root.parent in details:root=root.parent
        if root.name not in kept:bpy.data.objects.remove(obj,do_unlink=True)
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
    scene.world=bpy.data.worlds.new('Review studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.15,.19,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    scene.view_settings.view_transform='AgX'
    for position,energy,size in [((.15,-.25,.4),20,.3),((-.3,-.1,.2),15,.25),((0,.3,.25),25,.3)]:
        light=bpy.data.lights.new('Review softbox','AREA');light.energy=energy;light.shape='DISK';light.size=size;obj=bpy.data.objects.new('Review softbox',light);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,0,.03))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.cameras.new('Detail review camera');obj=bpy.data.objects.new('Detail review camera',camera);scene.collection.objects.link(obj);scene.camera=obj;camera.type='ORTHO';camera.ortho_scale=.36
    for name,position in [('front',( .30,-.40,.24)),('rear',(-.28,.38,.20)),('side',(.42,.02,.14))]:
        obj.location=position;obj.rotation_euler=(Vector((0,0,.035))-obj.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(identifier+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
    print('DETAIL_REVIEW',identifier,flush=True)
