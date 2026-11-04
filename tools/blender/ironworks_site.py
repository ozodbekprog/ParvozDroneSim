"""Assemble a full industrial site from licensed architecture and equipment.

Real-scale modular architecture, pitched roof surfaces, connected service roads
and distinct work zones. The original yard remains a small part of the site.
"""
import bpy, math, json
from mathutils import Vector,Matrix

def extend_site(root,scene,collection,library,worlds,append,place,facade,surface):
    assets=['overhead_crane','portable_generator','barrel_03','modular_electricity_poles','modular_chainlink_fence']
    for asset in assets:append(asset)
    repair_crane_material(root)
    zones=[]
    def pbr(id):
        source=root/'content/source-assets'/id
        mat=bpy.data.materials.new('Site '+id);mat.use_nodes=True
        nodes,links=mat.node_tree.nodes,mat.node_tree.links;bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        for kind,file in json.loads((source/'SOURCE.json').read_text())['files'].items():
            if kind not in ['diff','nor_gl','rough']:continue
            image=bpy.data.images.load(str(source/file['name']),check_existing=True)
            node=nodes.new('ShaderNodeTexImage');node.image=image
            if kind!='diff':image.colorspace_settings.name='Non-Color'
            if kind=='diff':links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
            elif kind=='rough':links.new(node.outputs['Color'],bsdf.inputs['Roughness'])
            else:
                normal=nodes.new('ShaderNodeNormalMap');links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
        return mat
    gravel,asphalt=pbr('gravel_road'),pbr('worn_asphalt')
    def pad(name,x0,y0,x1,y1,z,mat):
        obj=surface(name,[(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z)],[(x0/4,y0/4),(x1/4,y0/4),(x1/4,y1/4),(x0/4,y1/4)])
        obj.data.materials.clear();obj.data.materials.append(mat);obj['site_ground']=True
        return obj
    pad('Site terrain apron',-190,-160,190,160,-.04,gravel)
    pad('Site east west service road',-145,-90,145,-78,-.02,asphalt)
    pad('Site north south spine',24,-112,36,112,-.015,asphalt)
    pad('Site foundry access',-125,27,36,39,-.012,asphalt)
    pad('Site loading dock approach',36,19,138,31,-.012,asphalt)
    pad('Site maintenance access',-130,-42,24,-30,-.012,asphalt)
    pad('Site equipment working apron',43,-79,87,-42,-.01,asphalt)

    def building(name,cx,cy,width,depth,height,gabled=True):
        before=set(collection.objects);x0,x1=cx-width/2,cx+width/2;y0,y1=cy-depth/2,cy+depth/2
        edges=[((x0,y0),(1,0),width,True),((x1,y0),(0,1),depth,False),((x1,y1),(-1,0),width,True),((x0,y1),(0,-1),depth,False)]
        for (start,direction,length,portal) in edges:
            angle=math.atan2(direction[1],direction[0]);steps=round(length/3)
            for row in range(round(height/3)):
                for i in range(steps):
                    if row==0 and portal and steps//2-1<=i<=steps//2:continue
                    point=(start[0]+direction[0]*i*3,start[1]+direction[1]*i*3,row*3)
                    # Tall upper windows and solid ground plinths retain the kit's
                    # authored reveals, mullions, rounded trims and measured UVs.
                    if row==0:
                        facade('wall_standard_standard_01',(-20,0,0),point,angle)
                    else:
                        facade('wall_window_centered_large_01',(0,0,4),point,angle)
                        facade('window_centered_large_01',(0,0,4),point,angle)
            if portal:
                start_d=(start[0]+direction[0]*(length/2-3),start[1]+direction[1]*(length/2-3),0)
                facade('wall_door_garage_centered_01',(-16,0,0),start_d,angle)
            for i in range(steps):
                point=(start[0]+direction[0]*i*3,start[1]+direction[1]*i*3,height)
                facade('crown_standard_standard_01',(-20,0,7),point,angle)
            for i in range(0,steps+1,3):
                for row in range(round(height/3)):
                    if portal and row==0 and abs(i*3-length/2)<.6:continue
                    point=(start[0]+direction[0]*i*3,start[1]+direction[1]*i*3,row*3)
                    facade('wall_pier_standard_01',(-28,0,0),point,angle)
        if gabled:
            ridge=height+min(3.6,depth*.16)
            surface('Warehouse roof '+name+' west',[(x0,y0,height),(cx,y0,ridge),(cx,y1,ridge),(x0,y1,height)],[(0,0),(width/8,0),(width/8,depth/4),(0,depth/4)])
            surface('Warehouse roof '+name+' east',[(cx,y0,ridge),(x1,y0,height),(x1,y1,height),(cx,y1,ridge)],[(0,0),(width/8,0),(width/8,depth/4),(0,depth/4)])
            for y in [y0,y1]:
                obj=surface('Warehouse roof '+name+' gable',[(x0,y,height),(x1,y,height),(cx,y,ridge)],[(0,0),(width/4,0),(width/8,(ridge-height)/4)])
        else:surface('Warehouse roof '+name,[(x0,y0,height),(x1,y0,height),(x1,y1,height),(x0,y1,height)],[(0,0),(width/4,0),(width/4,depth/4),(0,depth/4)])
        for obj in set(collection.objects)-before:obj['site_zone']=name
        # PBR floor slabs inside both portal buildings; corridors remain clear.
        pad('Site floor '+name,x0,y0,x1,y1,-.005,asphalt)
        zones.append({'name':name,'centre':[cx,height/2,-cy],'footprint':[width,depth],'height':height})

    building('Foundry hall',-90,65,54,36,12)
    building('Rail loading hall',90,45,60,24,9)
    building('Maintenance depot',-95,-55,24,18,6)
    building('Control tower',124,-73,12,12,18,False)
    zones.extend([{'name':'Original assembly courtyard','centre':[0,2,0],'footprint':[48,48]},
                  {'name':'Pipe service yard','centre':[65,3,60],'footprint':[44,37]},
                  {'name':'Open western flight field','centre':[-80,2,-6],'footprint':[100,48]}])

    def prop_group(asset,destination,rotation=0,scale=1,prefix=None,origin=(0,0,0)):
        for name,obj in library[asset].items():
            if obj.type!='MESH' or (prefix and not name.startswith(prefix)):continue
            placed=place(asset,name,origin,destination,rotation,scale)
            if asset in ['overhead_crane','portable_generator','modular_electricity_poles','modular_chainlink_fence']:
                mod=placed.modifiers.new('Site flight delivery detail','DECIMATE');mod.ratio={'overhead_crane':.35,'portable_generator':.35,'modular_electricity_poles':.25,'modular_chainlink_fence':.35}[asset]
    prop_group('overhead_crane',(-90,65,10),0,1)
    prop_group('overhead_crane',(90,45,7.5),0,1)
    for p in [(-109,54,0),(-75,74,0),(72,42,0),(105,47,0),(-103,-53,0),(51,-67,0)]:prop_group('portable_generator',p)
    for cx,cy in [(-109,76),(-73,75),(74,53),(106,36),(-103,-60),(52,-52)]:
        for dx,dy in [(0,0),(.8,0),(.4,.7)]:prop_group('barrel_03',(cx+dx,cy+dy,0))
    # A road-side utility line, with complete authored insulators, fuses and caps.
    for x in [-130,-90,-50,-10,30,70,110]:prop_group('modular_electricity_poles',(x,-93,0),0,1,'preset_03',(-6.5,0,0))
    # A short safety fence around equipment, rather than a perimeter cage.
    for x in range(45,85,2):
        place('modular_chainlink_fence','modular_chainlink_fence_double',(-2,0,0),(x,-41,0))
        place('modular_chainlink_fence','modular_chainlink_fence_post',(-1,1,0),(x,-41,0))
    # Authored flanged pipe assemblies, elevated over clear flight lanes.
    pipe='modular_industrial_pipes_01';part='modular_industrial_pipes_01_pipe02'
    base=library[pipe][part];points=[worlds[pipe][part]@Vector(v) for v in base.bound_box]
    lo=Vector([min(p[a] for p in points) for a in range(3)]);hi=Vector([max(p[a] for p in points) for a in range(3)]);mid=(lo+hi)/2;extent=hi-lo
    def beam(name,a,b,radius=.16):
        direction=Vector(b)-Vector(a);length=direction.length
        obj=base.copy();obj.data=base.data;obj.parent=None;obj.constraints.clear();collection.objects.link(obj);obj.name=name
        rotation=Vector((0,0,1)).rotation_difference(direction.normalized()).to_matrix().to_4x4()
        obj.matrix_world=Matrix.Translation((Vector(a)+Vector(b))/2)@rotation@Matrix.Diagonal((radius*2/extent.x,radius*2/extent.y,length/extent.z,1))@Matrix.Translation(-mid)@worlds[pipe][part]
        obj['source_asset']=pipe
    for y in [-76,-68,-60,-52,-44]:
        for x in [46,84]:beam('modular_industrial_pipes site riser',(x,y,0),(x,y,7.5))
        beam('modular_industrial_pipes site header',(46,y,7.5),(84,y,7.5),.22)
    # A second level gives the pipe yard a distinct tall silhouette.
    for y in [-72,-56]:beam('modular_industrial_pipes high cross',(46,y,11.5),(84,y,11.5),.15)
    for x in [46,84]:beam('modular_industrial_pipes high riser',(x,-64,0),(x,-64,12))
    scene['site_zones']=json.dumps(zones)
    scene['site_size_metres']='300 x 240; visual ground apron 380 x 320'
    return zones

def repair_crane_material(root):
    # glTF cannot represent the author's mixed RGB-mask shader. Use the supplied
    # baked PBR maps, rather than exporting the control mask as visible paint.
    for mat in bpy.data.materials:
        if not mat.name.startswith('overhead_crane_trim'):continue
        nodes,links=mat.node_tree.nodes,mat.node_tree.links;nodes.clear()
        bsdf=nodes.new('ShaderNodeBsdfPrincipled');output=nodes.new('ShaderNodeOutputMaterial');links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
        folder=root/'content/source-assets/overhead_crane/textures'
        for suffix,slot in [('diff','Base Color'),('rough','Roughness'),('metal','Metallic'),('nor_gl',None)]:
            image=bpy.data.images.load(str(folder/('overhead_crane_trim_'+suffix+'_1k.png')),check_existing=True)
            tex=nodes.new('ShaderNodeTexImage');tex.image=image
            if suffix!='diff':image.colorspace_settings.name='Non-Color'
            if slot:links.new(tex.outputs['Color'],bsdf.inputs[slot])
            else:
                normal=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
