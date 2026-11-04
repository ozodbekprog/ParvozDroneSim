"""Blender-native material batches retaining UVs and corner normals.

Avoid quadratic object joins for maps with thousands of window/detail objects.
The editable source scene is never merged or saved in its delivery form.
"""
import bpy
import array
import math
from mathutils import Vector
_color_cache={}
def baked_color(mat,uv):
    if not mat:return (.25,.25,.25,1)
    if 'window' in mat.name.lower():return (.065,.08,.095,1)
    key=mat.as_pointer()
    if key not in _color_cache:
        nodes=mat.node_tree.nodes if mat.use_nodes else []
        image=next((n.image for n in nodes if n.type=='TEX_IMAGE' and n.image and (n.label in ('_MainTex','_BaseMap') or any(s in n.image.name.lower() for s in ['diff','albedo','basecolor']))),None)
        if image:
            sample=image.copy();sample.scale(64,64)
            _color_cache[key]=(list(sample.pixels),64)
            bpy.data.images.remove(sample)
        else:
            bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
            _color_cache[key]=(tuple(bsdf.inputs['Base Color'].default_value) if bsdf else tuple(mat.diffuse_color),0)
    values,size=_color_cache[key]
    if not size:return values
    offset=(int((uv[1]%1)*size)*size+int((uv[0]%1)*size))*4
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in values[offset:offset+3])+(1,)

def distant_material():
    mat=bpy.data.materials.get('Ironworks distance baked color')
    if mat:return mat
    mat=bpy.data.materials.new('Ironworks distance baked color');mat.use_nodes=True
    bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    color=mat.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='Color'
    mat.node_tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.85
    return mat


def material_key(mat):
    if not mat:return ('none',)
    if not mat.use_nodes:return ('plain',tuple(mat.diffuse_color),mat.roughness,mat.metallic)
    nodes=mat.node_tree.nodes
    # Merge equivalent imported stock PBR materials; keep complex developer shaders distinct.
    supported={'ShaderNodeBsdfPrincipled','ShaderNodeOutputMaterial','ShaderNodeTexImage','ShaderNodeNormalMap','ShaderNodeUVMap'}
    if any(n.bl_idname not in supported for n in nodes):return ('custom',mat.as_pointer())
    values=[]
    for node in nodes:
        defaults=[]
        for socket in node.inputs:
            if hasattr(socket,'default_value'):
                value=socket.default_value
                try:value=tuple(value)
                except TypeError:pass
                defaults.append((socket.name,value))
        values.append((node.bl_idname,tuple(defaults),getattr(getattr(node,'image',None),'name',None),getattr(node,'extension',None)))
    links=tuple(sorted((l.from_node.bl_idname,l.from_socket.name,l.to_node.bl_idname,l.to_socket.name) for l in mat.node_tree.links))
    return (tuple(sorted(values,key=lambda v:repr(v))),links,mat.diffuse_color[3],mat.use_backface_culling)


def export_material_batches(path, excluded, cell_size=None, extra_uv=None, instanced=None, keep=False, name='Runtime', origin=None, vertex_colors=False, color_layer=None, planar_dissolve=False,input_objects=None):
    root_name=name
    source=[obj for obj in (list(bpy.context.scene.objects) if input_objects is None else input_objects) if obj.type=='MESH' and not excluded(obj) and not obj.hide_render]
    instances=[obj for obj in source if instanced and instanced(obj)]
    source=[obj for obj in source if obj not in instances]
    # Apply modifiers to delivery copies together. Clearing one evaluated mesh at a
    # time otherwise repeatedly invalidates the dependency graph of large scenes.
    scratch=bpy.data.collections.new('TEMP evaluated export copies')
    bpy.context.scene.collection.children.link(scratch)
    if not keep or any(obj.modifiers or planar_dissolve for obj in source):bpy.ops.object.select_all(action='DESELECT')
    copies=[];raw=[]
    for obj in source:
        if obj.modifiers or planar_dissolve:
            copy=obj.copy();copy.data=obj.data.copy();scratch.objects.link(copy)
            copy.parent=None;copy.matrix_world=obj.matrix_world.copy();copy.select_set(True)
            if planar_dissolve:
                modifier=copy.modifiers.new('Coplanar surface merge','DECIMATE');modifier.decimate_type='DISSOLVE';modifier.angle_limit=.00001
                modifier.use_dissolve_boundaries=False;modifier.delimit={'NORMAL','MATERIAL','UV'}
            bpy.context.view_layer.objects.active=copy;copies.append(copy)
        else:raw.append(obj)
    if copies:bpy.ops.object.convert(target='MESH')
    source=raw+copies
    print('EXPORT_SOURCE_OBJECTS',len(source),'modified',len(copies),flush=True)
    batches = {}
    material_keys={}
    completed=0
    for obj in source:
        evaluated=obj
        mesh=obj.data
        try:
            if input_objects is not None and not evaluated.parent:world=evaluated.matrix_basis.copy()
            else:world = evaluated.matrix_world.copy()
            if origin:world.translation-=Vector(origin)
            normal_matrix = world.to_3x3().inverted().transposed()
            uv = mesh.uv_layers.active
            # Bulk reads avoid repeatedly asking Blender's lazy normal/UV caches for each corner.
            coordinates=array.array('f',[0])* (len(mesh.vertices)*3)
            mesh.vertices.foreach_get('co',coordinates)
            positions=[tuple(world @ Vector(coordinates[i:i+3])) for i in range(0,len(coordinates),3)]
            indices=array.array('i',[0])*len(mesh.loops)
            mesh.loops.foreach_get('vertex_index',indices)
            normals=array.array('f',[0])*(len(mesh.loops)*3)
            mesh.corner_normals.foreach_get('vector',normals)
            normal_values=[tuple((normal_matrix @ Vector(normals[i:i+3])).normalized()) for i in range(0,len(normals),3)]
            uv_values=array.array('f',[0])*(len(mesh.loops)*2)
            if uv: uv.data.foreach_get('uv',uv_values)
            extra_uv_values=array.array('f',uv_values)
            if extra_uv and mesh.uv_layers.get(extra_uv): mesh.uv_layers[extra_uv].data.foreach_get('uv',extra_uv_values)
            color_values=array.array('f',[1])*(len(mesh.loops)*4)
            if color_layer and mesh.color_attributes.get(color_layer):
                attribute=mesh.color_attributes[color_layer]
                if attribute.domain!='CORNER':raise ValueError('Runtime color layer must use corner data: '+obj.name)
                attribute.data.foreach_get('color',color_values)
            for poly in mesh.polygons:
                mat = mesh.materials[poly.material_index] if len(mesh.materials) > poly.material_index else None
                original_mat=mat
                if vertex_colors:mat=distant_material()
                pointer=mat.as_pointer() if mat else 0
                if pointer not in material_keys:material_keys[pointer]=material_key(mat)
                # Keep visibility bounds local. A whole-map material batch prevents
                # the renderer from culling walls behind the camera.
                center = world @ poly.center
                batch_cell_size=min(16,cell_size) if cell_size and mat and mat.get('terrainDetail') else cell_size
                cell = tuple(math.floor(center[i] / batch_cell_size) for i in range(3)) if batch_cell_size else None
                key = (batch_cell_size,cell,material_keys[pointer])
                batch = batches.setdefault(key, {'cell':cell, 'cellSize':batch_cell_size, 'material':mat, 'vertices':[], 'faces':[], 'uv':[], 'uv_extra':[], 'normals':[], 'colors':[], 'index':{}})
                face = []
                face_positions=[]
                for li in poly.loop_indices:
                    position=positions[indices[li]];texcoord=(uv_values[li*2],uv_values[li*2+1]);normal=normal_values[li]
                    if face_positions and position==face_positions[-1]:continue
                    face_positions.append(position)
                    texcoord_extra=(extra_uv_values[li*2],extra_uv_values[li*2+1])
                    color=baked_color(original_mat,texcoord) if vertex_colors else tuple(color_values[li*4:li*4+4])
                    if vertex_colors and color_layer:color=tuple(color[a]*color_values[li*4+a] for a in range(3))+(color[3],)
                    vertex_key=(position,texcoord,normal,texcoord_extra,color)
                    vertex=batch['index'].get(vertex_key)
                    if vertex is None:
                        vertex=len(batch['vertices']);batch['index'][vertex_key]=vertex
                        batch['vertices'].append(position);batch['uv'].append(texcoord);batch['normals'].append(normal)
                        batch['uv_extra'].append(texcoord_extra)
                        batch['colors'].append(color)
                    face.append(vertex)
                if len(face)>2 and face_positions[0]==face_positions[-1]:face.pop();face_positions.pop()
                if len(set(face_positions))>=3:batch['faces'].append(face)
        finally:
            pass
        completed+=1
        if completed%200==0:print('PACKED_OBJECTS',completed,flush=True)
    if not batches and not instances:
        raise ValueError('No visible map geometry')
    temp = bpy.data.collections.new('TEMP compact runtime batches')
    bpy.context.scene.collection.children.link(temp)
    if not keep:bpy.ops.object.select_all(action='DESELECT')
    try:
        # Preserve authored prop geometry and repeated transforms inside a spatial
        # cell. glTF Transform turns shared meshes into EXT_mesh_gpu_instancing.
        instance_meshes={}
        depsgraph=bpy.context.evaluated_depsgraph_get() if instances else None
        for original in instances:
            cell=tuple(math.floor(original.matrix_world.translation[i]/cell_size) for i in range(3)) if cell_size else ()
            key=(original.data.as_pointer(),cell)
            if key not in instance_meshes:
                if original.modifiers:
                    evaluated=original.evaluated_get(depsgraph)
                    mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
                    mesh.name='Repeated '+original.data.name+' cell '+str(cell)
                else:mesh=original.data
                instance_meshes[key]=mesh
            obj=bpy.data.objects.new('Repeated '+original.name,instance_meshes[key]);temp.objects.link(obj)
            obj.matrix_world=original.matrix_world.copy()
            obj['runtimeCell']=list(cell);obj['runtimeCellSize']=cell_size
            obj['terrainVegetation']=bool(original.get('terrainVegetation'))
            if origin:obj.matrix_world.translation-=Vector(origin)
            obj.select_set(True)
        for key,batch in batches.items():
            name = 'Runtime ' + (batch['material'].name if batch['material'] else 'unpainted')
            mesh = bpy.data.meshes.new(name)
            mesh.from_pydata(batch['vertices'], [], batch['faces'])
            mesh.update()
            uv = mesh.uv_layers.new(name='UVMap')
            loop_vertices=[i for face in batch['faces'] for i in face]
            uv.data.foreach_set('uv',array.array('f',(v for i in loop_vertices for v in batch['uv'][i])))
            if extra_uv:
                layer=mesh.uv_layers.new(name=extra_uv)
                layer.data.foreach_set('uv',array.array('f',(v for i in loop_vertices for v in batch['uv_extra'][i])))
                mesh.uv_layers.active_index=0
            if vertex_colors or color_layer:
                colors=mesh.color_attributes.new(name=color_layer or 'Color',type='FLOAT_COLOR',domain='CORNER')
                colors.data.foreach_set('color',array.array('f',(v for i in loop_vertices for v in batch['colors'][i])))
            if batch['material']:
                mesh.materials.append(batch['material'])
            if hasattr(mesh,'normals_split_custom_set'):
                mesh.normals_split_custom_set([batch['normals'][i] for i in loop_vertices])
            obj = bpy.data.objects.new(name,mesh)
            if batch['cell'] is not None:
                obj['runtimeCell']=list(batch['cell']);obj['runtimeCellSize']=batch['cellSize']
            temp.objects.link(obj)
            if not keep:
                obj.select_set(True)
                bpy.context.view_layer.objects.active = obj
        root=None
        if keep:
            root=bpy.data.objects.new(root_name,None);temp.objects.link(root)
            named=set()
            for obj in list(temp.objects):
                if obj!=root:
                    obj.parent=root
                    if obj.data.as_pointer() not in named:obj.data.name=root_name+' '+obj.data.name;named.add(obj.data.as_pointer())
        else:
            bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                     use_active_scene=True,
                                     export_yup=True, export_extras=False,
                                     export_cameras=False, export_lights=False)
        print('MATERIAL_BATCHES',len(batches),flush=True)
        return root
    finally:
        if not keep:
            meshes=set(obj.data for obj in temp.objects)
            for obj in list(temp.objects):bpy.data.objects.remove(obj,do_unlink=True)
            for mesh in meshes:bpy.data.meshes.remove(mesh)
            bpy.data.collections.remove(temp)
        scratch_objects=list(scratch.objects);scratch_meshes={obj.data for obj in scratch_objects}
        bpy.data.batch_remove(ids=[*scratch_objects,*scratch_meshes])
        bpy.data.collections.remove(scratch)
