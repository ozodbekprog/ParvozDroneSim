"""Export only recovered authored meshes; retain the editable scene separately."""
import bpy,json,sys,gc
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import ROOT,RECOVERY,PROFILE,MAP_FOLDER,NODE_PREFIX
from runtime_export import export_material_batches
from export_package import is_authoring
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
probe='--probe' in argv
source=RECOVERY/'probe.blend' if probe else MAP_FOLDER/'map.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
from scene_visual_policy import apply_scene_policy
apply_scene_policy(PROFILE,RECOVERY)
# Upgrade the preview multiply nodes to the glTF exporter's supported Mix node.
for material in bpy.data.materials:
    if not material.use_nodes:continue
    nodes=material.node_tree.nodes;links=material.node_tree.links
    for old in list(nodes):
        if old.bl_idname!='ShaderNodeMixRGB' or old.blend_type!='MULTIPLY':continue
        node=nodes.new('ShaderNodeMix');node.data_type='RGBA';node.blend_type='MULTIPLY';node.inputs[0].default_value=1
        for index in [1,2]:
            if old.inputs[index].is_linked:links.new(old.inputs[index].links[0].from_socket,node.inputs[index+5])
            else:node.inputs[index+5].default_value=old.inputs[index].default_value
        for link in list(old.outputs[0].links):links.new(node.outputs[2],link.to_socket)
        nodes.remove(old)
target=RECOVERY/('probe.glb' if probe else 'runtime.glb')
cell_size=PROFILE['lod']['cellSize']
def environment_mesh(obj):
    return is_authoring(obj) or obj.get('excludedSceneryMarker') or any(
        material and any(marker in material.name for marker in ('PlayerDummy','DroneDummy','PowerBox','CombinedCharacter'))
        for material in obj.data.materials)
bpy.data.batch_remove(ids=[obj for obj in bpy.context.scene.objects if obj.type!='MESH' or environment_mesh(obj)])
bpy.data.orphans_purge(do_recursive=True)
print('DELIVERY_SOURCE_READY',len(bpy.context.scene.objects),flush=True)
for obj in bpy.context.scene.objects:
    if str(obj.get('source_game_object','')).startswith('terrain-tree-'):obj['terrainVegetation']=True
root=export_material_batches(target,environment_mesh,cell_size=cell_size,color_layer='BakedLighting',keep=True,name=NODE_PREFIX+'Runtime',planar_dissolve=PROFILE['lod'].get('planarDissolve',False),instanced=(lambda obj:bool(obj.get('terrainVegetation'))) if PROFILE['lod'].get('instanceVegetation') else None)
# The editable scene is already on disk. Drop its export-only copies before
# creating delivery levels instead of retaining two full outdoor environments.
retained={root,*root.children}
bpy.data.batch_remove(ids=[obj for obj in bpy.context.scene.objects if obj not in retained])
bpy.data.orphans_purge(do_recursive=True);gc.collect()
print('DELIVERY_BATCHES_READY',len(root.children),flush=True)
objects=[]
if not probe:
    cells={}
    for obj in list(root.children):cells.setdefault((obj.get('runtimeCellSize',cell_size),tuple(obj['runtimeCell'])),[]).append(obj)
    roots=[];definitions=[];discarded_far=[]
    def reduced(original,ratio,name):
        obj=original.copy();obj.data=original.data if PROFILE['lod'].get('preserveGeometry') else original.data.copy();obj.name=name
        bpy.context.scene.collection.objects.link(obj)
        if not PROFILE['lod'].get('preserveGeometry'):
            modifier=obj.modifiers.new('Delivery simplification','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
        return obj
    def apply_reductions(objects):
        if not objects:return
        objects=[obj for obj in objects if obj.modifiers]
        if not objects:return
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.convert(target='MESH')
    for number,((size,cell),meshes) in enumerate(sorted(cells.items())):
        origin=Vector(tuple((value+.5)*size for value in cell));levels=[]
        high=bpy.data.objects.new(NODE_PREFIX+'Chunk_%02d_LOD0'%number,None);bpy.context.scene.collection.objects.link(high)
        low=bpy.data.objects.new(NODE_PREFIX+'Chunk_%02d_LOD1'%number,None);bpy.context.scene.collection.objects.link(low)
        far_sources=[];low_sources=[]
        for obj in meshes:
            obj.parent=high;obj.location-=origin
            lod=reduced(obj,PROFILE['lod']['ratios'][0],'Low '+obj.name);lod.parent=low;low_sources.append(lod)
        apply_reductions(low_sources)
        for obj,lod in zip(meshes,low_sources):
            distant=reduced(lod,PROFILE['lod']['ratios'][1],'Far working '+obj.name);distant.parent=None
            far_sources.append(distant)
        apply_reductions(far_sources)
        # Keep UVs on broad architectural surfaces. Sampling only their few
        # corners into colors loses the floor markings and makes large patches.
        textured=[obj for obj in far_sources if not (obj.get('terrainDetail') or any(material and material.get('terrainDetail') for material in obj.data.materials)) and (obj.get('terrainVegetation') or any(
            material and any(word in material.name for word in PROFILE['lod']['texturedFarMaterials'])
            for material in obj.data.materials) or any(material and ('glass' in material.name.lower() or material.get('sourceAlphaMode')==1) for material in obj.data.materials))]
        def transparent(obj):
            for material in obj.data.materials:
                if material and material.use_nodes:
                    shader=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
                    if shader and (shader.inputs['Alpha'].is_linked or shader.inputs['Alpha'].default_value<.99):return True
            return False
        # Blended decals cannot be flattened into opaque vertex colors: their
        # empty rectangle would cover the garage floor. Keep textured markings;
        # small transparent overlays fade out with the distant LOD.
        colored=[obj for obj in far_sources if obj not in textured and not transparent(obj)]
        # A single retained mesh cannot benefit from merging. Reuse its source
        # PBR material rather than building thousands of one-face horizon batches.
        direct_colored=PROFILE['lod'].get('preserveGeometry') and len(colored)<=1
        merged=colored if not direct_colored else []
        far=export_material_batches(target,lambda obj:False,input_objects=merged,color_layer='BakedLighting',vertex_colors=True,keep=True,name=NODE_PREFIX+'Chunk_%02d_LOD2'%number) if merged else bpy.data.objects.new(NODE_PREFIX+'Chunk_%02d_LOD2'%number,None)
        if not merged:bpy.context.scene.collection.objects.link(far)
        if direct_colored:
            for obj in colored:obj.parent=far
        if textured:
            if PROFILE['lod'].get('preserveGeometry'):
                # These are already spatial material batches, at the same local
                # origin and without modifiers. Sharing them is exactly equivalent.
                for obj in textured:obj.parent=far
            else:
                surfaces=export_material_batches(target,lambda obj:False,input_objects=textured,color_layer='BakedLighting',keep=True,name='Far textured surfaces')
                for obj in list(surfaces.children):obj.parent=far
                bpy.data.objects.remove(surfaces,do_unlink=True)
        # One dependency-graph cleanup avoids a whole-scene invalidation per cell.
        discarded_far.extend(obj for obj in far_sources if obj.parent!=far)
        roots.extend([high,low,far]);levels=[high,low,far]
        definitions.append({'model':'model.glb','modelNode':high.name,
            'modelLods':[{'model':'model.glb','modelNode':level.name,'distance':distance} for level,distance in zip(levels,PROFILE['lod']['distances'])],
            'lowLod':PROFILE['lod']['lowLod'],'position':[origin.x,origin.z,-origin.y],'rotation':[0,0,0],'scale':1})
        print('CHUNK_LODS',number,[sum(len(o.data.polygons) for o in level.children) for level in levels],flush=True)
    print('DELIVERY_LODS_READY',len(definitions),'discarded',len(discarded_far),flush=True)
    bpy.data.batch_remove(ids=discarded_far)
    bpy.data.objects.remove(root,do_unlink=True)
    root=bpy.data.objects.new(NODE_PREFIX+'Environment',None);bpy.context.scene.collection.objects.link(root)
    (RECOVERY/'runtime-objects.json').write_text(json.dumps(definitions,indent=2))
    print('DELIVERY_SELECTING',len(roots),flush=True)
    bpy.ops.object.select_all(action='DESELECT')
    for level in roots:
        level.select_set(True)
        for obj in level.children:obj.select_set(True);objects.append(obj)
else:
    for obj in root.children:obj.select_set(True);objects.append(obj)
root.select_set(True)
print('DELIVERY_WRITING',len(objects),flush=True)
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,
    export_yup=True,export_extras=True,export_cameras=False,export_lights=False,
    export_vertex_color='NAME',export_vertex_color_name='BakedLighting',export_all_vertex_colors=False)
report={'objects':len(objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),
    'bytes':target.stat().st_size,'cellSize':cell_size,'preserveGeometry':PROFILE['lod'].get('preserveGeometry',False),'source':str(source),'target':str(target)}
(RECOVERY/('probe-export.json' if probe else 'runtime-export.json')).write_text(json.dumps(report,indent=2))
print('RUNTIME_EXPORT',json.dumps(report),flush=True)
