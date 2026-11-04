import importlib.util, json, math, tempfile
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

root=Path('C:/DroneLiftoffUz')
spec=importlib.util.spec_from_file_location('package_export',root/'tools/blender/export_package.py')
tool=importlib.util.module_from_spec(spec);spec.loader.exec_module(tool)
bpy.ops.wm.read_factory_settings(use_empty=True)
angles=(.22,.61,-.37)
assert max(abs(a-b) for a,b in zip(angles,tool.three_euler(tool.three_rotation(angles))))<1e-6
bpy.ops.mesh.primitive_cube_add(size=1)
cube=bpy.context.object;cube.name='COLLIDER_rotated';cube['flightCollider']=True;cube['collisionType']='box'
cube.matrix_world=Matrix.Translation(tool.blender_point((8,3,-5)))@(tool.C@tool.three_rotation(angles)@tool.C.transposed()).to_4x4()@Matrix.Diagonal((4,6,2,1))
bpy.context.view_layer.update()
collider=tool.box_collision(cube)
assert collider['position']==[8,3,-5],collider
assert max(abs(a-b) for a,b in zip(collider['size'],[4,2,6]))<1e-5,collider
assert max(abs(a-b) for a,b in zip(angles,collider['rotation']))<1e-6,collider
assert tool.is_authoring(cube)
cube['colliderMetadata']=json.dumps({'type':'capsule','axis':1,'radius':1,'halfLength':1})
rounded_collider=tool.box_collision(cube)
assert rounded_collider['radius']==3 and rounded_collider['halfLength']==0,rounded_collider
assert rounded_collider['size']==[6,6,6],rounded_collider
tool.validate_collisions([rounded_collider])
cube.scale *= 2
bpy.context.view_layer.update()
assert abs(tool.box_collision(cube)['radius']-6)<1e-5
cube['colliderMetadata']='{}'
fixture={'id':'fixture-course','map':'fixture','laps':3,'spawn':{'position':[2,2,-10],'yaw':.7},'gates':[{'position':[5,4,7],'yaw':1.1,'width':1.8,'height':1.6,'gateClass':'precision-5','frameThickness':.1,'support':{'type':'ground','baseY':0},'customHint':'preserve'}]}
tool.map_races=lambda map_id:[(root/'data/fixture-race.json',fixture)]
assert tool.add_routes('fixture')==1
bpy.context.view_layer.update()
updated=tool.read_routes('fixture')[0][1]
assert updated['id']==fixture['id'] and updated['laps']==3
assert updated['gates'][0]['position']==[5,4,7]
assert abs(updated['gates'][0]['yaw']-1.1)<1e-6,updated
assert updated['gates'][0]['customHint']=='preserve'
assert updated['spawn']['position']==[2,2,-10]
gate=next(obj for obj in bpy.context.scene.objects if obj.get('flightGate'))
gate.scale.x=2;bpy.context.view_layer.update()
assert tool.read_routes('fixture')[0][1]['gates'][0]['width']==3.6
gate['supportBaseY']=10
try:
    tool.read_routes('fixture')
    raise AssertionError('Bad support anchor accepted')
except ValueError as error:
    assert 'below' in str(error)
gate['supportBaseY']=0
for invalid in [{'position':[float('nan'),0,0],'size':[1,1,1]}, {'type':'mesh','vertices':[float('inf')]*9}, {**rounded_collider,'radius':-1}, {**rounded_collider,'size':[1,1,1]}]:
    try:
        tool.validate_collisions([invalid])
        raise AssertionError('Non-finite collision accepted')
    except ValueError:
        pass
bpy.ops.mesh.primitive_cube_add(size=2,location=(0,0,5))
visible=bpy.context.object;visible.name='Visible architecture';visible.data.materials.append(bpy.data.materials.new('Fixture material'))
with tool.working_directory(prefix='blender-focused-check-') as folder:
    folder=Path(folder).resolve();assert folder.is_relative_to((root/'data').resolve())
    native=folder/'map.blend';bpy.ops.wm.save_as_mainfile(filepath=str(native));before=native.read_bytes()
    tool.export_runtime(folder/'model.glb')
    assert before==native.read_bytes(),'Exporter changed saved native source'
    binary=(folder/'model.glb').read_bytes();length=int.from_bytes(binary[12:16],'little');data=json.loads(binary[20:20+length])
    assert len(data.get('meshes',[]))==1,data.get('meshes')
    assert all(not node.get('name','').startswith(('COLLIDER','GATE','SPAWN')) for node in data.get('nodes',[]))
print('BLENDER_PACKAGE_CHECK: rotations, proxy dimensions, marker pose/scale/preserved fields, source preservation and runtime exclusions passed.')
