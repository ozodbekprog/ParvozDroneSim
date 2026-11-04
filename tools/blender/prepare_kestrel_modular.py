"""Split complete authored SCOUT/HUNTER models into compatible modular assets.

All visible geometry and UVs come from the licensed source. Scripts perform
import, semantic separation, axis normalization, reversible delivery reduction
and export. No generated substitute drone geometry.
"""
import bpy, json, math, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from neutral_kestrel_finish import neutralize_finish
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'content/drones/kestrel'
TEMP=ROOT/'data/art-build/kestrel-modular';TEMP.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(ROOT/'content/source-assets/3d-husky-drone/original.glb'))
bpy.context.view_layer.update()
scale=.115/math.hypot(12.4958,15.1368)
orient=Matrix(((scale,0,0,0),(0,0,-scale,0),(0,scale,0,0),(0,0,0,1)))
yaw=Matrix.Rotation(math.pi/2,4,'Z') # the source camera faces -X; game forward is +Z
sources={};materials={}
for variant_name in ['SCOUT','HUNTER']:
    variant=bpy.data.objects[variant_name];inverse=variant.matrix_world.inverted();meshes=[]
    for obj in list(bpy.context.scene.objects):
        ancestor=obj
        while ancestor.parent and ancestor!=variant:ancestor=ancestor.parent
        if obj.type!='MESH' or ancestor!=variant:continue
        copy=obj.copy();copy.data=obj.data.copy();copy.parent=None;copy.animation_data_clear();copy.matrix_world=Matrix.Identity(4)
        copy.data.transform(orient@inverse@obj.matrix_world);copy.name='Imported_'+variant_name+'_'+obj.name
        bpy.context.scene.collection.objects.link(copy);meshes.append(copy)
    sources[variant_name]=meshes
for obj in list(bpy.context.scene.objects):
    if not any(obj in meshes for meshes in sources.values()):bpy.data.objects.remove(obj,do_unlink=True)
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    if 'decal' not in mat.name.lower():
        for link in list(bsdf.inputs['Alpha'].links):mat.node_tree.links.remove(link)
        bsdf.inputs['Alpha'].default_value=1
    elif bsdf.inputs['Alpha'].links:
        source=bsdf.inputs['Alpha'].links[0].from_socket
        clip=mat.node_tree.nodes.new('ShaderNodeMath');clip.operation='GREATER_THAN';clip.inputs[1].default_value=.1
        mat.node_tree.links.new(source,clip.inputs[0]);mat.node_tree.links.new(clip.outputs[0],bsdf.inputs['Alpha'])
    mat.use_backface_culling=False

main=bpy.context.scene;main.name='Kestrel assembled'
templates=bpy.data.scenes.new('Kestrel interchangeable authored parts')
root=bpy.data.objects.new('Kestrel',None);main.collection.objects.link(root)
root.rotation_euler.y=math.pi;root['upright_normalization_v2']=True
CAMERA={118,121,122,235}
BATTERY={63,64,116,117,123,124,126,207,209,210,222}
FINISH={17,18,19,20}
anchor={'frame':Vector((0,0,0)),'camera':yaw@Vector((-.032,0,.01)),'battery':Vector((0,0,.024))}
parts={};semantic=[]
def group(name,scene,parent=None,position=None):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent
    if position is not None:o.location=position
    return o
def join(objects,name,parent,origin):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0]
    o.name=name;o.data.transform(yaw);o.data.transform(Matrix.Translation(-origin));o.parent=parent;o.matrix_basis=Matrix.Identity(4)
    return o
def template_copy(objects,name,origin):
    g=group('Template_'+name,templates)
    for original in objects:
        o=original.copy();o.data=original.data;templates.collection.objects.link(o);o.parent=g;o.matrix_basis=Matrix.Identity(4)
        o.name=original.name+'_Template'
    return g

for variant,meshes in sources.items():
    body=next(o for o in meshes if ('Scout_Scout_0' if variant=='SCOUT' else 'Hunter_HUNTER_0') in o.name and 'Decal' not in o.name)
    inspection=body.copy();inspection.data=body.data.copy();main.collection.objects.link(inspection)
    bpy.ops.object.select_all(action='DESELECT');inspection.select_set(True);bpy.context.view_layer.objects.active=inspection
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
    components=list(bpy.context.selected_objects)
    categories={'frame':[],'camera':[],'battery':[],'finish':[]}
    for o in components:
        index=int(o.name.split('.')[-1]);category='camera' if index in CAMERA else 'battery' if index in BATTERY else 'finish' if index in FINISH else 'frame'
        categories[category].append(o)
    if len(components)!=379:raise ValueError('Authored topology changed; re-inspect semantic component IDs')
    variant_parts={}
    for category in ['frame','camera','battery']:
        g=group('Part_'+category+'_'+variant,main)
        contents=[join(categories[category],category.title()+'_'+variant,g,anchor[category])]
        if category=='frame':
            contents.append(join(categories['finish'],'Frame_Finish_'+variant,g,anchor[category]))
            decal=next(o for o in meshes if 'decal_scout_' in o.name.lower() or 'decal_hunter_' in o.name.lower())
            decal.data.transform(yaw);decal.parent=g;decal.matrix_basis=Matrix.Identity(4);decal.name='Frame_Decal_'+variant
            contents.append(decal)
        # Standalone zero-origin templates share authored mesh data/materials.
        for o in contents:o['part_category']=category
        template_copy(contents,g.name,anchor[category])
        variant_parts[category]=g
    # Source rotor 1 provides a complete authored motor/propeller template.
    for category in ['motors','propellers']:
        prefix='Motor_1_' if category=='motors' else ('Prop_1_' if variant=='SCOUT' else 'Prop1_')
        o=next(o for o in meshes if o.name.startswith('Imported_'+variant+'_'+prefix) and 'decal' not in o.name.lower())
        source_pivot=Vector((-12.4958*scale,15.1368*scale,1.25*scale))
        o.data.transform(yaw);o.data.transform(Matrix.Translation(-(yaw@source_pivot)))
        g=group('Part_'+category+'_'+variant,main);o.parent=g;o.matrix_basis=Matrix.Identity(4);o.name=category.title()+'_'+variant
        o['part_category']=category
        contents=[o]
        decal_prefix='Motor_1_decal_' if variant=='SCOUT' and category=='motors' else 'Decal_motor_1_' if category=='motors' else 'Decal_motor_1_' if variant=='SCOUT' else 'Decal_prop_1_'
        matches=[d for d in meshes if d!=o and decal_prefix.lower() in d.name.lower()]
        if matches:
            d=matches[0];d.data.transform(yaw);d.data.transform(Matrix.Translation(-(yaw@source_pivot)))
            d.parent=g;d.matrix_basis=Matrix.Identity(4);d.name=category.title()+'_Decal_'+variant;d['part_category']=category;contents.append(d)
        template_copy(contents,g.name,Vector());variant_parts[category]=g
    parts[variant]=variant_parts
    retained={o for g in variant_parts.values() for o in g.children}
    for o in meshes:
        if o not in retained and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)

# Main scene is a complete base drone. Templates are in a separate non-default
# glTF scene: all part selections share one asset's textures and geometry cache.
bindings={};mounts={};rotors=[]
for category in ['frame','camera','battery']:
    base=parts['SCOUT'][category];base.name=category.title()+'_Default';base.parent=root;base.location=anchor[category]
    bindings[category]=[base.name];mount=group('Mount_'+category,main,root,anchor[category]);mounts[category]=[mount.name]
for category in ['motors','propellers']:
    prototype=parts['SCOUT'][category];bindings[category]=[];mounts[category]=[]
    for index,(sx,sz) in enumerate(((1,1),(-1,1),(-1,-1),(1,-1))):
        p=Vector((-sx*15.1368*scale,-sz*12.4958*scale,1.25*scale))
        parent=root
        if category=='propellers':parent=group('Rotor_'+str(index),main,root,p);rotors.append(parent.name)
        g=group(category.title()+'_Default_'+str(index),main,parent,p if category=='motors' else Vector())
        for original in prototype.children:
            o=original.copy();o.data=original.data;main.collection.objects.link(o);o.parent=g;o.matrix_basis=Matrix.Identity(4);o.name=original.name+'_Default_'+str(index)
        bindings[category].append(g.name);mounts[category].append(group('Mount_'+category+'_'+str(index),main,root,p).name)
    for o in list(prototype.children):bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.objects.remove(prototype,do_unlink=True)
for g in list(parts['HUNTER'].values()):
    for o in list(g.children):bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.objects.remove(g,do_unlink=True)
main['source_license']='CC-BY-SA-4.0 — 3D Husky (Kawasalto); SOURCE.json'
main['variant_note']='SCOUT/HUNTER authored finishes; HUNTER has a distinct two-blade propeller. Other variants retain the author\'s shared component shapes.'
main['semantic_review']='Component diagnostic renders in data/art-build/kestrel/components; camera/battery/frame checked before grouping.'
finish=neutralize_finish(TEMP/'finish')
color_bindings={role:[name for name,materials in finish.items() if any(material['role']==role for material in materials)] for role in ['body','led']}
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kestrel.blend'),compress=True)
originals={o:o.data for s in [main,templates] for o in s.objects if o.type=='MESH'}
report={'mounts':mounts,'partBindings':bindings,'motorBindings':rotors,'colorBindings':color_bindings,'cameraFaces':'+Z','levels':[],'variants':['SCOUT','HUNTER']}
for label,ratios in [('hangar',{'frame':.92,'camera':.92,'battery':.92,'motors':.92,'propellers':.92}),('low',{'frame':.17,'camera':.55,'battery':.3,'motors':.55,'propellers':.35}),('far',{'frame':.035,'camera':.15,'battery':.08,'motors':.12,'propellers':.06})]:
    for o,data in originals.items():
        o.data=data.copy()
        if 'decal' not in o.name.lower():
            bpy.context.window.scene=main if o in main.objects[:] else templates
            bpy.context.view_layer.objects.active=o
            modifier=o.modifiers.new('Independent '+label+' delivery','DECIMATE');modifier.ratio=ratios[o.get('part_category','frame')]
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.context.window.scene=main
    total=0
    for o in main.objects:
        if o.type=='MESH':o.data.calc_loop_triangles();total+=len(o.data.loop_triangles)
    bpy.ops.export_scene.gltf(filepath=str(TEMP/(label+'.raw.glb')),export_format='GLB',use_selection=False,use_active_scene=False,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=False)
    report['levels'].append({'name':label,'assembledTriangles':total})
    for o,data in originals.items():
        reduced=o.data;o.data=data;bpy.data.meshes.remove(reduced)
(OUT/'preparation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('KESTREL_MODULAR',json.dumps(report),flush=True)
