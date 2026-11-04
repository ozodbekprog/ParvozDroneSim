"""Map recovered Unity Standard materials to editable Blender/glTF PBR."""
import bpy,json
def build_materials(resources,folder):
    files={entry['key']:folder/entry['file'] for entry in resources['textures']};images={}
    def image(key):
        if key not in images:images[key]=bpy.data.images.load(str(files[key]),check_existing=True)
        return images[key]
    materials={}
    for entry in resources['materials']:
        source=json.loads((folder/entry['file']).read_text());props=source.get('m_SavedProperties',{});colors={**props.get('m_Colors',{}),**entry.get('pbrOverrides',{}).get('colors',{})};floats={**props.get('m_Floats',{}),**entry.get('pbrOverrides',{}).get('floats',{})}
        mat=bpy.data.materials.new(entry['name']);mat.use_nodes=True
        mat['sourceMaterialKey']=entry['key']
        if entry.get('shader')=='Unity Terrain Detail (static source billboard)':mat['terrainDetail']=True
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF');color=colors.get('_Color',{})
        shader.inputs['Base Color'].default_value=tuple(color.get('m_'+a,1) for a in 'RGBA')
        mode=floats.get('_Mode',0);alpha=color.get('m_A',1) if mode>=2 else 1
        mat['sourceAlphaMode']=mode
        shader.inputs['Alpha'].default_value=alpha
        shader.inputs['Roughness'].default_value=max(.04,1-floats.get('_Glossiness',.3));shader.inputs['Metallic'].default_value=floats.get('_Metallic',0)
        if '_EmissionColor' in entry.get('pbrOverrides',{}).get('colors',{}):
            emission=colors['_EmissionColor'];shader.inputs['Emission Color'].default_value=tuple(emission.get('m_'+a,1) for a in 'RGBA');shader.inputs['Emission Strength'].default_value=1
        if mode>=2:mat.surface_render_method='BLENDED'
        for slot,key in entry.get('textures',{}).items():
            if slot not in ('_MainTex','_BaseMap','_BumpMap','_EmissionMap','_OcclusionMap','_MetallicRoughnessMap'):continue
            node=nodes.new('ShaderNodeTexImage');node.image=image(key);node.label=slot
            if slot in ('_MainTex','_BaseMap'):
                links.new(node.outputs['Color'],shader.inputs['Base Color'])
                if mode in (1,2,3):
                    gain=nodes.new('ShaderNodeMath');gain.operation='GREATER_THAN' if mode==1 else 'MULTIPLY'
                    gain.inputs[1].default_value=floats.get('_Cutoff',.5) if mode==1 else alpha
                    links.new(node.outputs['Alpha'],gain.inputs[0]);links.new(gain.outputs[0],shader.inputs['Alpha'])
            elif slot=='_BumpMap':
                node.image.colorspace_settings.name='Non-Color';normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=floats.get('_BumpScale',1)
                links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
            elif slot=='_MetallicRoughnessMap':
                node.image.colorspace_settings.name='Non-Color';separate=nodes.new('ShaderNodeSeparateColor');links.new(node.outputs['Color'],separate.inputs['Color'])
                links.new(separate.outputs['Green'],shader.inputs['Roughness']);links.new(separate.outputs['Blue'],shader.inputs['Metallic'])
            elif slot=='_EmissionMap':
                links.new(node.outputs['Color'],shader.inputs['Emission Color']);emission=colors.get('_EmissionColor',{})
                shader.inputs['Emission Strength'].default_value=max(emission.get('m_'+a,0) for a in 'RGB')
                if entry['name']=='CeilingLightsOff01':shader.inputs['Emission Strength'].default_value=.8
            elif slot=='_OcclusionMap':
                node.image.colorspace_settings.name='Non-Color';group=bpy.data.node_groups.get('glTF Material Output')
                if group is None:
                    group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree');group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat');group.nodes.new('NodeGroupInput')
                output=nodes.new('ShaderNodeGroup');output.node_tree=group
                separate=nodes.new('ShaderNodeSeparateColor');links.new(node.outputs['Color'],separate.inputs['Color']);links.new(separate.outputs['Green'],output.inputs['Occlusion'])
            environment=entry.get('textureEnvironments',{}).get(slot,props.get('m_TexEnvs',{}).get(slot,{}))
            scale=environment.get('m_Scale',{'m_X':1,'m_Y':1});offset=environment.get('m_Offset',{'m_X':0,'m_Y':0})
            if tuple(scale.values())!=(1,1) or tuple(offset.values())!=(0,0):
                uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(scale['m_X'],scale['m_Y'],1);mapping.inputs['Location'].default_value=(offset['m_X'],offset['m_Y'],0)
                links.new(uv.outputs['UV'],mapping.inputs['Vector']);links.new(mapping.outputs['Vector'],node.inputs['Vector'])
        vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='BakedLighting';base=shader.inputs['Base Color']
        multiply=nodes.new('ShaderNodeMix');multiply.data_type='RGBA';multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
        if base.is_linked:links.new(base.links[0].from_socket,multiply.inputs[6])
        else:multiply.inputs[6].default_value=base.default_value
        links.new(vertex.outputs['Color'],multiply.inputs[7]);links.new(multiply.outputs[2],base)
        materials[entry['key']]=mat
    return materials,images,image
