"""Apply Parvoz's explicit visible-scene policy during future Blender exports."""
import bpy,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SURFACES=ROOT/'content/shared-assets/parvoz-neutral-surfaces'
POLICY=json.loads((SURFACES/'policy.json').read_text())

def material_kind(name):
    name=re.sub(r'\.\d{3}$','',name)
    if any(name.lower().startswith(p.lower()) for p in POLICY['clothPrefixes']) or name in POLICY['clothNames']:return 'cloth'
    if name in POLICY['displayNames']:return 'display'
    if name in POLICY['plaqueNames']:return 'plaque'

def neutral_materials(materials=None):
    image=None;changed=[]
    for material in (list(bpy.data.materials) if materials is None else materials):
        kind=material_kind(material.name)
        if not kind:continue
        material.use_nodes=True;nodes=material.node_tree.nodes;links=material.node_tree.links
        shader=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not shader:continue
        for name in ('Base Color','Normal','Metallic','Roughness','Emission Color','Emission Strength'):
            for link in list(shader.inputs[name].links):links.remove(link)
        shader.inputs['Metallic'].default_value=.1 if kind=='plaque' else 0
        shader.inputs['Roughness'].default_value=.9 if kind=='cloth' else .75
        shader.inputs['Emission Color'].default_value=(0,0,0,1);shader.inputs['Emission Strength'].default_value=0
        if kind=='cloth':
            if image is None:image=bpy.data.images.load(str(SURFACES/'fabric.png'),check_existing=True);image.pack()
            tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.label='Parvoz neutral fabric'
            mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
            tint=.11 if re.search('Dark|Black|InflatableArchBrandless',material.name,re.I) else .88
            mix.inputs[7].default_value=(tint,tint,tint,1);links.new(tex.outputs['Color'],mix.inputs[6]);links.new(mix.outputs[2],shader.inputs['Base Color'])
        else:shader.inputs['Base Color'].default_value=(.035,.045,.055,1) if kind=='display' else (.24,.25,.26,1)
        material['parvozBrandingRemoved']=True;changed.append(material.name)
    return changed

def apply_scene_policy(profile,recovery):
    settings=profile.get('sceneRepairs',{})
    if not settings:return
    resources=json.loads((recovery/'resources.json').read_text());records=json.loads((recovery/resources['records']).read_text())
    parents={r['data']['m_GameObject']['m_PathID']:(None if r['data']['m_Father']['m_PathID']=='0' else records[r['data']['m_Father']['m_PathID']]['data']['m_GameObject']['m_PathID']) for r in records.values() if r['type']=='Transform'}
    shadow={r['data']['m_GameObject']['m_PathID'] for r in records.values() if r['type']=='MeshRenderer' and r['data'].get('m_CastShadows')==3}
    def preview(go):
        while go:
            if records.get(go,{}).get('name','').startswith('FreezeFrameFinish'):return True
            go=parents.get(go)
        return False
    for obj in bpy.context.scene.objects:
        go=str(obj.get('source_game_object',''))
        if (settings.get('suppressShadowOnly') and go in shadow) or (settings.get('excludePreviewFinish') and preview(go)):
            obj.hide_render=True;obj['excludedSceneryMarker']=True
    if settings.get('neutralBranding'):neutral_materials()

if __name__=='__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name in ('AirflagLiftoffFinishWhite01','AirflagLiftoffFinishDark01','StadiumScreenLiftoff01','LuGusStoneLogoOFF01'):
        material=bpy.data.materials.new(name);material.use_nodes=True;material.use_fake_user=True
    neutral_materials();bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SURFACES/'surfaces.blend'))
