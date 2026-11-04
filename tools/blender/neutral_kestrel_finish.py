import bpy
import numpy as np

def neutralize_finish(OUT):
    OUT.mkdir(parents=True,exist_ok=True)
    material_cache={}; image_cache={}; report={}; original_names={}
    for obj in bpy.data.objects:
        body=obj.type=='MESH' and (obj.name.startswith('Frame_SCOUT') or obj.name.startswith('Frame_HUNTER') or obj.name.startswith('Frame_Finish_'))
        led=obj.type=='MESH' and obj.name.startswith('Motors_Decal_')
        if not(body or led):continue
        role='body' if body else 'led'; report[obj.name]=[]
        for slot in obj.material_slots:
            original=slot.material
            if not original or not original.use_nodes:continue
            original_name=original_names.get(original,original.name)
            key=(original_name,role)
            if key not in material_cache:
                mat=original.copy(); mat.name='Kestrel_'+role+'_'+original.name
                original_names[mat]=original_name
                bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
                links=bsdf.inputs['Base Color'].links
                if not links or links[0].from_node.type!='TEX_IMAGE':raise RuntimeError('Inspect non-image base color: '+original.name)
                node=links[0].from_node; source=node.image; image_key=(source.name,role)
                if image_key not in image_cache:
                    width,height=source.size
                    data=np.empty(width*height*4,dtype=np.float32);source.pixels.foreach_get(data);rgba=data.reshape(-1,4)
                    gray=rgba[:,:3]@np.array([.2126,.7152,.0722],dtype=np.float32)
                    rgba[:,:3]=gray[:,None]
                    image=bpy.data.images.new('Kestrel_'+role+'_'+source.name,width,height,alpha=True)
                    image.colorspace_settings.name=source.colorspace_settings.name
                    image.pixels.foreach_set(data);image.update()
                    image.filepath_raw=str(OUT/(role+'-'+str(len(image_cache))+'.png'));image.file_format='PNG';image.save();image.pack()
                    image_cache[image_key]=image
                node.image=image_cache[image_key]
                material_cache[key]=(mat,node.image)
            mat,image=material_cache[key];slot.material=mat
            report[obj.name].append({'originalMaterial':original_name,'material':mat.name,'image':Path(image.filepath_raw).name,'role':role})

    return report
