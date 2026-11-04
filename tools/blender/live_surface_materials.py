"""Paint tileable PBR images and unwrap surfaces INSIDE the open Blender scene.

Loaded in the live Blender MCP session. Does not launch Blender or save a map.
"""
import math
from pathlib import Path
import bpy
import numpy as np

def category(name):
    name = name.lower()
    # A map's ID is not a material category (e.g. every Neon material must not
    # be mistaken for an emissive surface merely because its prefix is Neon).
    if name.startswith('mcp authored '):
        name = name.split(' ', 3)[-1]
    if any(word in name for word in ('glaz', 'glass', 'water', 'sea', 'light', 'paint', 'marker', 'neon', 'emiss', 'leaf', 'foliage')):
        return None
    if any(word in name for word in ('timber', 'wood', 'bark', 'plank', 'trunk')): return 'wood'
    if any(word in name for word in ('rock', 'stone', 'sandstone', 'masonry', 'brick')): return 'stone'
    if any(word in name for word in ('asphalt', 'concrete', 'plaster', 'gravel', 'floor', 'wall')): return 'mineral'
    if any(word in name for word in ('steel', 'metal', 'iron', 'oxide', 'teal', 'corrug', 'roof', 'sheet')): return 'metal'
    return None

def noise_field(size, seed):
    rng = np.random.default_rng(seed)
    total = np.zeros((size, size), dtype=np.float32)
    coords = np.arange(size, dtype=np.float32) / size
    for cells, weight in ((4,.52),(8,.25),(16,.13),(32,.07),(64,.03)):
        grid = rng.random((cells,cells), dtype=np.float32)
        t = coords*cells; lower=np.floor(t).astype(int); f=t-lower; f=f*f*(3-2*f)
        xx=lower[None,:]; yy=lower[:,None]; fx=f[None,:]; fy=f[:,None]
        smooth=(grid[yy%cells,xx%cells]*(1-fx)+grid[yy%cells,(xx+1)%cells]*fx)*(1-fy)
        smooth+=(grid[(yy+1)%cells,xx%cells]*(1-fx)+grid[(yy+1)%cells,(xx+1)%cells]*fx)*fy
        total+=weight*smooth
    return total

def paint_material(material, kind, directory, size=256):
    nodes=material.node_tree.nodes; links=material.node_tree.links
    principled=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    if principled.inputs['Base Color'].is_linked: return False
    seed=sum((i+1)*ord(c) for i,c in enumerate(material.name))
    field=noise_field(size,seed)
    xx,yy=np.meshgrid(np.arange(size)/size,np.arange(size)/size)
    fine=np.random.default_rng(seed+73).random((size,size))
    if kind=='wood':
        grain=np.sin(2*math.pi*(xx*24+(field-.5)*2))
        tone=.83+.22*field+.055*grain
        height=.004*grain+.002*field
        scale=1.6
    elif kind=='metal':
        tone=.89+.20*field+.028*(fine-.5)
        height=.0006*field+.00008*fine
        scale=2.5
    elif kind=='stone':
        bands=np.sin(2*math.pi*(yy*5+field*.8))
        tone=.77+.39*field+.025*bands
        height=.014*field+.0007*fine
        scale=3.
    else:
        tone=.78+.35*field+.05*(fine-.5)
        height=.005*field+.00035*fine
        scale=3.
    base=np.asarray(principled.inputs['Base Color'].default_value[:3])
    linear=np.clip(tone[:,:,None]*base[None,None,:],0,1)
    srgb=np.where(linear<=.0031308,linear*12.92,1.055*np.power(linear,1/2.4)-.055)
    gx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*size/(2*scale)
    gy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*size/(2*scale)
    normal=np.stack((-gx,-gy,np.ones_like(gx)),axis=2)
    normal/=np.sqrt(np.sum(normal*normal,axis=2))[:,:,None]
    file_stem=''.join(c.lower() if c.isalnum() else '-' for c in material.name).strip('-')
    for suffix,rgb,is_normal in (('color',srgb,False),('normal',normal*.5+.5,True)):
        image=bpy.data.images.new('MCP painted '+material.name+' '+suffix,width=size,height=size,alpha=False)
        if is_normal:
            options=[item.identifier for item in image.colorspace_settings.bl_rna.properties['name'].enum_items]
            # OCIO color spaces are dynamically registered; assignment verifies the value.
            try:image.colorspace_settings.name='Non-Color'
            except TypeError:pass
        rgba=np.concatenate((rgb,np.ones((size,size,1))),axis=2).astype(np.float32)
        image.pixels.foreach_set(rgba.ravel());image.update()
        image.filepath_raw=str(directory/(file_stem+'-'+suffix+'.png'))
        formats=[item.identifier for item in image.bl_rna.properties['file_format'].enum_items]
        if 'PNG' not in formats: raise ValueError('PNG image output unavailable')
        image.file_format='PNG';image.save();image.pack()
        texture=nodes.new('ShaderNodeTexImage');texture.image=image
        texture.label='Painted in Blender — '+kind+' '+suffix
        texture.location=(-480,120 if not is_normal else -150)
        if not is_normal: links.new(texture.outputs['Color'],principled.inputs['Base Color'])
        else:
            normal_node=nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.65
            normal_node.location=(-190,-150)
            links.new(texture.outputs['Color'],normal_node.inputs['Color'])
            links.new(normal_node.outputs['Normal'],principled.inputs['Normal'])
    material['mcpPaintedPBR']=True
    material['mcpTextureScale']=scale
    return True

def unwrap_object(obj):
    mesh=obj.data
    if mesh.uv_layers: return False
    if not any(material and material.get('mcpPaintedPBR') for material in mesh.materials): return False
    if not len(mesh.polygons):return False
    coordinates=np.empty(len(mesh.vertices)*3,dtype=np.float32)
    mesh.vertices.foreach_get('co',coordinates);coordinates=coordinates.reshape(-1,3)
    matrix=np.asarray(obj.matrix_world,dtype=np.float32)
    world=coordinates@matrix[:3,:3].T+matrix[:3,3]
    vertex_indices=np.empty(len(mesh.loops),dtype=np.int32);mesh.loops.foreach_get('vertex_index',vertex_indices)
    normals=np.empty(len(mesh.polygons)*3,dtype=np.float32);mesh.polygons.foreach_get('normal',normals)
    normals=normals.reshape(-1,3)@np.linalg.inv(matrix[:3,:3])
    start=np.empty(len(mesh.polygons),dtype=np.int32);count=start.copy()
    mesh.polygons.foreach_get('loop_start',start);mesh.polygons.foreach_get('loop_total',count)
    axis=np.repeat(np.argmax(np.abs(normals),axis=1),count)
    positions=world[vertex_indices]
    uv=np.empty((len(vertex_indices),2),dtype=np.float32)
    for dominant,first,second in ((0,1,2),(1,0,2),(2,0,1)):
        mask=axis==dominant
        uv[mask,0]=positions[mask,first]/3.
        uv[mask,1]=positions[mask,second]/3.
    layer=mesh.uv_layers.new(name='UVMap');layer.data.foreach_set('uv',uv.ravel())
    return True

def apply():
    filepath=Path(bpy.data.filepath)
    if filepath.name!='map.blend' or filepath.parent.parent.name!='maps': raise ValueError('Open canonical map.blend first')
    directory=filepath.parent/'textures'/'blender-painted';directory.mkdir(parents=True,exist_ok=True)
    painted=0
    for material in bpy.data.materials:
        kind=category(material.name)
        if not kind or not material.node_tree or material.get('mcpPaintedPBR'):continue
        node=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if node:painted+=bool(paint_material(material,kind,directory))
    unwrapped=0
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and not obj.get('flightCollider') and not obj.get('authoring_only'):
            unwrapped+=bool(unwrap_object(obj))
    bpy.context.view_layer.update()
    return {'paintedMaterials':painted,'unwrappedObjects':unwrapped}
