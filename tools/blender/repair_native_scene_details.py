"""Fix existing authored socket and remove source gameplay placeholders. No new meshes."""
import bpy,json,sys
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
ROOT=Path(__file__).resolve().parents[2]
folder=ROOT/'content/drones/luma-5'
bpy.ops.wm.open_mainfile(filepath=str(folder/'luma-5.blend'))
if not bpy.context.scene.get('battery_native_socket_v3'):
    config=json.loads((ROOT/'data/liftoff-drone-recovery/gate-prefab-config.json').read_text())
    root=next(r for r in config['roots'] if r['name']=='Luma5Frame01')
    records=[r for r in config['records'].values() if r['collection']==root['collection']]
    byid={r['id']:r for r in records};transforms={r['data']['m_GameObject']['m_PathID']:r for r in records if r['type']=='Transform'}
    def local(t):
        def vec(d):return Vector(tuple(d.get('m_'+a,0) for a in 'XYZ'))
        return Matrix.LocRotScale(vec(t['m_LocalPosition']),Quaternion(tuple(t['m_LocalRotation']['m_'+a] for a in 'WXYZ')),vec(t['m_LocalScale']))
    def world(go):
        t=transforms[go]['data'];p=t['m_Father']['m_PathID']
        return (world(byid[p]['data']['m_GameObject']['m_PathID']) if p!='0' else Matrix.Identity(4))@local(t)
    slot=next(r for r in records if r['type']=='GameObject' and r['name']=='BatterySlot')
    slot_transform=transforms[slot['id']]
    children=[byid[p['m_PathID']] for p in slot_transform['data']['m_Children']]
    snap=next((r for r in children if byid[r['data']['m_GameObject']['m_PathID']]['name']=='SnapPoint'),None)
    native=world(root['id']).inverted()@world(slot['id'])@(local(snap['data']) if snap else Matrix.Identity(4))
    B=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));F=Matrix.Diagonal(Vector((-1,1,1,1)))
    desired=B@F@native@F@B.inverted();mount=bpy.data.objects['mount_battery'];delta=desired@mount.matrix_world.inverted()
    for obj in bpy.context.scene.objects:
        if obj.name.startswith('Battery_'):obj.matrix_world=delta@obj.matrix_world
    mount.matrix_world=desired
    bpy.context.scene['battery_native_socket_v3']=True;bpy.context.scene['battery_native_bottom_v2']=True
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/'luma-5.blend'))
bpy.ops.export_scene.gltf(filepath=str(folder/'model.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
print('NATIVE_BATTERY_SOCKET',list(bpy.data.objects['mount_battery'].matrix_world.translation),flush=True)
for identifier in ['minus-two-demo','hangar-c03-demo','liftoff-arena-demo']:
    path=ROOT/'content/maps'/identifier/'map.blend';bpy.ops.wm.open_mainfile(filepath=str(path));names=[]
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH' and any(m and any(marker in m.name for marker in ('PlayerDummy','DroneDummy','PowerBox','CombinedCharacter')) for m in obj.data.materials):
            obj['excludedSceneryMarker']=True;obj.hide_render=True;obj.hide_viewport=True;names.append(obj.name)
    bpy.ops.wm.save_as_mainfile(filepath=str(path));print('REMOVED_PLACEHOLDERS',identifier,names,flush=True)
