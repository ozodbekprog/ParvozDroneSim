"""Developer-only FBX/OBJ to embedded GLB conversion. Run through import-content.js."""
import bpy
import os
import sys

source, destination = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
extension = os.path.splitext(source)[1].lower()
if extension == '.fbx':
    bpy.ops.import_scene.fbx(filepath=source)
elif extension == '.obj':
    if hasattr(bpy.ops.wm, 'obj_import'):
        bpy.ops.wm.obj_import(filepath=source)
    else:
        bpy.ops.import_scene.obj(filepath=source)
else:
    raise ValueError('Expected FBX or OBJ')

# Keep all meshes, material slots and custom properties for gate/collision markers.
# Blender's glTF exporter embeds supported PBR textures; arbitrary shaders need baking.
bpy.ops.export_scene.gltf(filepath=destination, export_format='GLB', export_extras=True, export_yup=True)
