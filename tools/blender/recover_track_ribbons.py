"""Restore source ribbon paths as editable static strips, without rebuilding track props."""
import bpy,json,math,sys
from pathlib import Path
import xml.etree.ElementTree as ET
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
MATERIALS=ROOT/'content/shared-assets/liftoff-track-ribbons'
MAPS=['hangar-c03-demo','liftoff-arena-demo','minus-two-demo','liftoff-pine-valley-demo','liftoff-the-green-demo']
selected=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--map=')),None)
if selected:MAPS=[selected]
def vector(item,path):
    value=item.find(path)
    return Vector(tuple(float(value.findtext(a,'0')) for a in 'xyz'))
def material(name):
    existing=bpy.data.materials.get(name)
    if existing:return existing
    result=bpy.data.materials.new(name);result.use_nodes=True;result.use_backface_culling=False
    shader=next(n for n in result.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    image=bpy.data.images.load(str(MATERIALS/(name+'.png')),check_existing=True);image.pack()
    texture=result.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image;texture.extension='REPEAT'
    result.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color']);shader.inputs['Metallic'].default_value=0;shader.inputs['Roughness'].default_value=.35
    result['sourceRibbonMaterial']=name;return result

for map_id in MAPS:
    profile=json.loads((ROOT/'tools/import-profiles'/(map_id+'.json')).read_text());recovery=ROOT/profile['staging']
    config=json.loads((recovery/'gate-prefab-config.json').read_text());roots={r['name']:r for r in config['roots']}
    for destination in sorted((ROOT/'content/races').glob(map_id+'-liftoff-*')):
        source=json.loads((destination/'SOURCE.json').read_text());track_file=recovery/'source-tracks'/(source['trackResource']+'.xml')
        track=ET.parse(track_file).getroot();blueprints=list(track.find('blueprints'))
        ribbons=[(i,item) for i,item in enumerate(blueprints) if item.find('attachPoints') is not None]
        if not ribbons:continue
        bpy.ops.wm.read_factory_settings(use_empty=True);group=bpy.data.objects.new('Original source track ribbons',None);bpy.context.scene.collection.objects.link(group)
        report={'race':destination.name,'sourceTrack':track_file.name,'representation':'Static strips retain source attachment positions, width, tiling and materials. Source rope dynamics are not simulated.','ribbons':[],'triangles':0}
        for index,item in ribbons:
            name=item.findtext('itemID')
            if name not in ('TapeWhiteRed01','TapeYellowBlack01'):raise RuntimeError('Unsupported source ribbon: '+name)
            prefab=roots[name]
            definitions=[r['data']['m_Structure'] for r in config['records'].values() if r['type']=='MonoBehaviour' and r['collection']==prefab['collection'] and r['data']['m_GameObject']['m_PathID']==prefab['id'] and r['data'].get('m_Structure',{}).get('ribbonMaterial')]
            if len(definitions)!=1:raise RuntimeError('Ambiguous ribbon definition: '+name)
            settings=definitions[0];radius=float(settings['radius']);density=max(1,float(settings['sectionsPerUnit']))
            original=[vector(point,'position') for point in item.find('attachPoints')]
            points=[];distance=0
            for a,b in zip(original,original[1:]):
                length=(b-a).length
                if length<0.000001:continue
                count=max(1,math.ceil(length*density))
                for n in range(count):points.append((a.lerp(b,n/count),distance+length*n/count))
                distance+=length
            if not points:continue
            points.append((original[-1],distance))
            game=[Vector((-p.x,-p.z,p.y)) for p,_ in points];vertices=[];uv=[]
            for n,p in enumerate(game):
                tangent=game[min(n+1,len(game)-1)]-game[max(n-1,0)]
                side=tangent.cross(Vector((0,0,1)))
                if side.length<0.000001:side=tangent.cross(Vector((0,1,0)))
                side.normalize();side*=radius
                vertices.extend([tuple(p-side),tuple(p+side)])
                v=points[n][1]/max(.001,radius*2*4)*float(settings.get('uvTileY',1))
                uv.extend([(0,v),(float(settings.get('uvTileX',1)),v)])
            faces=[(n*2,n*2+1,n*2+3,n*2+2) for n in range(len(game)-1)]
            mesh=bpy.data.meshes.new(name+' source ribbon');mesh.from_pydata(vertices,[],faces);mesh.materials.append(material(name))
            layer=mesh.uv_layers.new(name='UVMap')
            for polygon in mesh.polygons:
                for loop in polygon.loop_indices:layer.data[loop].uv=uv[mesh.loops[loop].vertex_index]
            obj=bpy.data.objects.new(name+'_'+str(index)+'_'+item.findtext('instanceID',''),mesh);bpy.context.scene.collection.objects.link(obj);obj.parent=group
            obj['source_blueprint_index']=index;obj['source_instance_id']=item.findtext('instanceID','');obj['source_attachment_points']=json.dumps([list(p) for p in original])
            report['ribbons'].append({'blueprintIndex':index,'instance':item.findtext('instanceID'),'prefab':name,'attachments':[list(p) for p in original],'width':radius*2,'length':distance,'triangles':len(faces)*2})
            report['triangles']+=len(faces)*2
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(destination/'ribbons.blend'))
        inputs=ROOT/'data/map-repair-20261031/ribbon-delivery-inputs';inputs.mkdir(parents=True,exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(inputs/(destination.name+'.glb')),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
        (destination/'ribbon-source.json').write_text(json.dumps(report,indent=2)+'\n')
        print('SOURCE_RIBBONS',destination.name,len(report['ribbons']),report['triangles'],flush=True)
