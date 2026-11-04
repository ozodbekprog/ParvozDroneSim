"""Export saved detail art without any recovery cache or game installation.

Use this after editing details.blend. restore_drone_details.py is only the
explicit source-rebuild route and can overwrite manual work (backup retained).
"""
import bpy,json,tempfile,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'content/shared-assets/drone-details'
scratch=ROOT/'data/drone-detail-20261015/blender-temp';scratch.mkdir(parents=True,exist_ok=True)
def workspace_mkdtemp(suffix=None,prefix=None,dir=None):
    path=scratch/((prefix or 'image-')+next(tempfile._get_candidate_names())+(suffix or ''))
    os.mkdir(path,0o777);return str(path)
tempfile.mkdtemp=workspace_mkdtemp;tempfile.tempdir=str(scratch)
for level in ['hangar','low','far']:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'details.blend'))
    for obj in list(bpy.context.scene.objects):
        if obj.type=='CURVE':
            obj.data.resolution_u={'hangar':8,'low':5,'far':3}[level];obj.data.bevel_resolution=2 if level=='hangar' else 1
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')
        elif obj.type=='MESH' and level!='hangar':
            obj.data=obj.data.copy();bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
            modifier=obj.modifiers.new('Small accessory delivery','DECIMATE');modifier.ratio=.6 if level=='low' else .22;modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(level+'-source.glb')),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
    print('EXPORTED_SAVED_DETAILS',level,flush=True)
