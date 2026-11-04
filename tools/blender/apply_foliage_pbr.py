"""Apply reviewed native foliage PBR channels to a separate editable candidate.
No geometry, UV, placements, course objects or original .blend are modified.
blender --background input.blend --python this.py -- metadata.json output.blend
"""
import bpy,json,pathlib,sys
metadata,output=sys.argv[sys.argv.index('--')+1:]
metadata=pathlib.Path(metadata).resolve();output=pathlib.Path(output).resolve()
if output==pathlib.Path(bpy.data.filepath).resolve():raise RuntimeError('Use a separate editable candidate')
data=json.loads(metadata.read_text(encoding='utf-8'));changed=[]
for entry in data['materials']:
    found=[material for material in bpy.data.materials if material.get('sourceMaterialKey')==entry['key']]
    if not found:raise RuntimeError('Missing authored material '+entry['key'])
    for material in found:
        nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
        if not shader:raise RuntimeError('Missing source PBR shader '+material.name)
        def texture(file,label):
            image=bpy.data.images.load(str(metadata.parent/file),check_existing=True);image.colorspace_settings.name='Non-Color';image.pack()
            node=nodes.new('ShaderNodeTexImage');node.image=image;node.label=label;return node
        if entry.get('normal'):
            if shader.inputs['Normal'].is_linked:raise RuntimeError('Existing native normal '+material.name)
            node=texture(entry['normal'],'Recovered native AG normal');normal=nodes.new('ShaderNodeNormalMap');links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
        if entry.get('roughness'):
            if shader.inputs['Roughness'].is_linked:raise RuntimeError('Existing native roughness '+material.name)
            node=texture(entry['roughness'],'Recovered source gloss to roughness');separate=nodes.new('ShaderNodeSeparateColor');links.new(node.outputs['Color'],separate.inputs['Color']);links.new(separate.outputs['Green'],shader.inputs['Roughness']);shader.inputs['Metallic'].default_value=0
        material['foliagePBR']='Native AG normal; source gloss to roughness, 20261018';changed.append(material.name)
bpy.ops.wm.save_as_mainfile(filepath=str(output),check_existing=False)
print('FOLIAGE_PBR_CANDIDATE',json.dumps({'output':str(output),'materials':changed}),flush=True)
