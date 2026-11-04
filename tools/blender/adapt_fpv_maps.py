"""Native Blender pass: pilot-height spaces, textured surfaces and FPV previews.

blender --background --python-exit-code 1 --python tools/blender/adapt_fpv_maps.py -- --all
Designed for 5/7-inch outdoor craft: broad approaches plus readable close features.
"""
import argparse
import array
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, noise

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import export_package as ep


def mat(name,color,metal=0):
    value=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.use_nodes=True
    bs=value.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=.76
    bs.inputs['Metallic'].default_value=metal
    return value


def texture_ground(package,collection,environment):
    desert=environment in ('canyon','ridgeway','sunscar')
    forest=environment in ('forest','pinecrest')
    base=(.31,.245,.17) if desert else (.14,.19,.12) if forest else (.24,.255,.255)
    size=256
    image=bpy.data.images.new('FPV ground base '+package.name,width=size,height=size)
    pixels=array.array('f')
    for y in range(size):
        for x in range(size):
            a=noise.noise(Vector((x/11,y/11,4)))
            b=noise.noise(Vector((x/3,y/3,11)))
            grit=1+a*.28+b*.16
            pixels.extend((*[max(0,min(1,v*grit)) for v in base],1))
    image.pixels.foreach_set(pixels)
    folder=package/'textures';folder.mkdir(exist_ok=True)
    image.filepath_raw=str(folder/'fpv-ground.png');image.file_format='PNG';image.save();image.pack()
    material=mat('FPV textured terrain '+package.name,base)
    bs=material.node_tree.nodes.get('Principled BSDF')
    tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    # Mesh UVs repeat the texture at four metre intervals; exported in standard glTF.
    extent=440 if package.name not in ('hangar','orbital') else 183
    regions=[(-extent,extent,-extent,extent)] if package.name!='harborworks' else [(-420,109,-420,420),(301,440,-420,420)]
    for index,(x0,x1,y0,y1) in enumerate(regions):
        mesh=bpy.data.meshes.new('FPV close ground surface')
        mesh.from_pydata([(x0,y0,.022),(x1,y0,.022),(x1,y1,.022),(x0,y1,.022)],[],[(0,1,2,3)])
        uv=mesh.uv_layers.new(name='UVMap')
        for li,p in zip(mesh.polygons[0].loop_indices,[(x0/4,y0/4),(x1/4,y0/4),(x1/4,y1/4),(x0/4,y1/4)]):uv.data[li].uv=p
        mesh.materials.append(material)
        obj=bpy.data.objects.new('FPV terrain texture surface '+str(index),mesh);collection.objects.link(obj)


def adapt(package,refresh_view=False):
    ep.backup_files(package,[package/'map.blend',package/'model.glb',package/'collision.json',package/'thumbnail.png',package/'map.json'])
    definition=ep.read_json(package/'map.json')
    bpy.ops.wm.open_mainfile(filepath=str(package/'map.blend'))
    scene=bpy.context.scene
    if scene.get('fpv_environment_pass'):
        meta=ep.read_json(package/'authoring.json')
        if not refresh_view and meta.get('fpvEnvironmentPass'):
            print('FPV_ALREADY_APPLIED '+package.name,flush=True);return
        if refresh_view:
            collection=bpy.data.collections.get('08 FPV pilot-height architecture and surfaces')
            for obj in list(collection.objects):
                if obj.name.startswith('FPV terrain texture surface'):
                    bpy.data.objects.remove(obj,do_unlink=True)
            texture_ground(package,collection,definition.get('environment',package.name))
        bpy.ops.wm.save_as_mainfile(filepath=str(package/'map.blend'))
        ep.export_runtime(package/'model.glb')
        bpy.ops.render.render(write_still=True)
        meta.update(fpvEnvironmentPass=1,fpvFeatures=scene.get('fpv_features',0),thumbnailView='pilot-height perspective',tool='Blender '+bpy.app.version_string)
        ep.write_json(package/'authoring.json',meta)
        print('FPV_VIEW_REFRESHED '+package.name,flush=True);return
    collision=ep.read_json(package/'collision.json')
    course_data=ep.map_races(package.name)
    collection=bpy.data.collections.new('08 FPV pilot-height architecture and surfaces')
    scene.collection.children.link(collection)
    environment=definition.get('environment',package.name)
    texture_ground(package,collection,environment)
    concrete=mat('FPV weathered concrete '+package.name,(.26,.28,.27))
    steel=mat('FPV galvanized metal '+package.name,(.19,.235,.245),.6)
    wood=mat('FPV weathered timber '+package.name,(.25,.17,.105))
    stone=mat('FPV natural stone '+package.name,(.32,.265,.20))
    ochre=mat('FPV route safety ochre '+package.name,(.62,.38,.07),.1)
    cool=mat('FPV route blue marker '+package.name,(.075,.24,.32),.2)

    def block(name,center,dimensions,material,yaw=0,solid=True):
        x,y,z=center;sx,sy,sz=dimensions
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(a*sx/2,b*sz/2,c*sy/2) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],[],[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)])
        mesh.materials.append(material)
        obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
        obj.location=ep.blender_point(center);obj.rotation_euler.z=yaw
        bevel=obj.modifiers.new('Readable softened edges','BEVEL');bevel.width=.06;bevel.segments=2
        if solid:collision.append({'position':list(center),'size':list(dimensions),'rotation':[0,yaw,0]})
        return obj

    features=0
    for _,course in course_data:
        for gi in [1,4,7]:
            if gi>=len(course['gates']):continue
            gate=course['gates'][gi];cx,cy,cz=gate['position'];yaw=gate['yaw']
            # Objects flank the actual race line. Doorways stay broad enough for curved approaches.
            width=max(12,gate['width']+6);depth=12;roof=max(8,cy+gate['height']/2+2)
            def place(name,x,y,z,sx,sy,sz,material,solid=True):
                return block(name,(cx+x*math.cos(yaw)+z*math.sin(yaw),y,cz-x*math.sin(yaw)+z*math.cos(yaw)),(sx,sy,sz),material,yaw,solid)
            prefix=course['id']+' pilot feature '+str(gi+1)
            if environment in ('forest','pinecrest'):
                # An open timber loading shelter gives the woodland a close, readable fly-through.
                material=wood
            elif environment in ('canyon','ridgeway','sunscar','ruins'):
                material=stone
            else:material=steel
            for x in [-width/2,width/2]:
                for z in [-depth/2,depth/2]:place(prefix+' structural pier',x,roof/2,z,.55,roof,.55,material)
                place(prefix+' side service barrier',x,1.1,0,.4,2.2,depth,concrete)
            for z in [-depth/2,0,depth/2]:place(prefix+' cross beam',0,roof,z,width+.8,.55,.8,material)
            place(prefix+' open passage roof',0,roof+.5,0,width+.8,.35,depth+1,material)
            # Roof vent and route-colour strips make elevations legible from FPV.
            place(prefix+' roof vent',width*.3,roof+1.2,0,2,1.1,2,steel)
            for x in [-width/2,width/2]:
                place(prefix+' near entrance marker',x,2,-depth/2-.35,.7,.35,.16,ochre,False)
                place(prefix+' far entrance marker',x,2,depth/2+.35,.7,.35,.16,cool,False)
            features+=1
    ep.write_json(package/'collision.json',collision)
    # Regenerate authoring guides and proxies from the authoritative package definitions.
    ep.add_routes(package.name)
    ep.add_collision_proxies(package,True)
    first=course_data[0][1]
    selected=first['gates'][1 if len(first['gates'])>1 else 0]
    center=Vector(selected['position'])
    normal=Vector((math.sin(selected['yaw']),0,math.cos(selected['yaw'])))
    position=center-normal*22+Vector((0,1,0))
    camera=bpy.data.objects.new('FPV pilot-height preview',bpy.data.cameras.new('FPV pilot-height preview'))
    scene.collection.objects.link(camera)
    camera.location=ep.blender_point(position)
    target=ep.blender_point(center+normal*12)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='PERSP';camera.data.lens=24;camera.data.clip_start=.02;camera.data.clip_end=5000
    scene.camera=camera
    scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=16
    scene.render.resolution_x=900;scene.render.resolution_y=506;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(package/'thumbnail.png')
    scene['fpv_environment_pass']=1
    scene['fpv_features']=features
    scene.view_settings.view_transform='AgX'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(package/'map.blend'))
    ep.export_runtime(package/'model.glb')
    bpy.ops.render.render(write_still=True)
    meta=ep.read_json(package/'authoring.json')
    meta.update(fpvEnvironmentPass=1,fpvFeatures=features,thumbnailView='pilot-height perspective',tool='Blender '+bpy.app.version_string)
    ep.write_json(package/'authoring.json',meta)
    print('FPV_ADAPTED '+package.name,flush=True)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--map');parser.add_argument('--all',action='store_true');parser.add_argument('--refresh-view',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    packages=sorted(ep.MAP_ROOT.iterdir()) if args.all else [ep.MAP_ROOT/args.map]
    for package in packages:
        if (package/'map.blend').exists():adapt(package,args.refresh_view)


if __name__=='__main__':main()
