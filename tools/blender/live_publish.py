"""Save and export the currently OPEN authored Blender map, without reloading it."""
from pathlib import Path
import json
import sys
import datetime
import bpy

ROOT=Path(__file__).resolve().parents[2]
if str(ROOT/'tools'/'blender') not in sys.path:sys.path.insert(0,str(ROOT/'tools'/'blender'))
import export_package as ep

def package_for_scene():
    source=Path(bpy.data.filepath).resolve()
    maps=(ROOT/'content'/'maps').resolve()
    if source.name!='map.blend' or source.parent.parent!=maps:
        raise ValueError('Live publishing requires the canonical content/maps/<id>/map.blend')
    return source.parent

def prepare_view():
    # Editor helpers stay editable in the Outliner, but do not obscure the model.
    for obj in bpy.context.scene.objects:
        if ep.is_authoring(obj):obj.hide_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type!='VIEW_3D':continue
            space=area.spaces.active
            space.clip_start=.025;space.clip_end=5000
            space.overlay.show_overlays=False
            valid=[item.identifier for item in space.region_3d.bl_rna.properties['view_perspective'].enum_items]
            if bpy.context.scene.camera and 'CAMERA' in valid:
                space.region_3d.view_perspective='CAMERA';space.region_3d.view_camera_zoom=0
            valid=[item.identifier for item in space.shading.bl_rna.properties['type'].enum_items]
            if 'SOLID' in valid:space.shading.type='SOLID'
            color_values=[item.identifier for item in space.shading.bl_rna.properties['color_type'].enum_items]
            if 'MATERIAL' in color_values:space.shading.color_type='MATERIAL'
            space.shading.show_shadows=True;space.shading.show_cavity=True
            area.tag_redraw()

def preview():
    package=package_for_scene();scene=bpy.context.scene
    if not scene.camera:raise ValueError('Map preview camera missing')
    scene.render.resolution_x=900;scene.render.resolution_y=506;scene.render.resolution_percentage=100
    formats=[item.identifier for item in scene.render.image_settings.bl_rna.properties['file_format'].enum_items]
    if 'PNG' not in formats:raise ValueError('PNG render output unavailable')
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(package/'thumbnail.png')
    bpy.ops.render.render(write_still=True)
    return {'thumbnail':scene.render.filepath,'camera':scene.camera.name}

def publish():
    package=package_for_scene();map_id=package.name
    if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    definition=ep.read_json(package/'map.json')
    if definition['id']!=map_id:raise ValueError('Map ID mismatch')
    collisions=ep.read_collisions(package);routes=ep.read_routes(map_id)
    changed=[package/'map.blend',package/'model.glb',package/'collision.json',package/'map.json']+[path for path,_ in routes]
    backup=ep.backup_files(package,changed)
    with ep.working_directory(prefix='mcp-live-publish-') as work:
        staging=Path(work)
        ep.export_runtime(staging/'model.glb')
        ep.write_json(staging/'collision.json',collisions)
        definition.update(model='model.glb',collisionFile='collision.json',colliders=[],theme='custom')
        # The authored source remains modular. Delivery batching uses temporary copies.
        prepare_view()
        bpy.ops.wm.save_as_mainfile(filepath=str(package/'map.blend'),compress=True)
        (staging/'model.glb').replace(package/'model.glb')
        (staging/'collision.json').replace(package/'collision.json')
        ep.write_json(package/'map.json',definition)
        for path,race in routes:ep.write_json(path,race)
    provenance=ep.read_json(package/'authoring.json') if (package/'authoring.json').exists() else {}
    provenance.update(liveBlenderMCP=True,liveModelingDate=datetime.datetime.now(datetime.timezone.utc).isoformat(),source='map.blend',model='model.glb')
    ep.write_json(package/'authoring.json',provenance)
    result={'map':map_id,'objects':len(bpy.context.scene.objects),'colliders':len(collisions),'courses':len(routes),'glbBytes':(package/'model.glb').stat().st_size,'backup':str(backup)}
    journal=ROOT/'data'/'live-blender-modeling.json'
    recorded=ep.read_json(journal) if journal.exists() else {}
    recorded[map_id]=result
    ep.write_json(journal,recorded)
    return result
