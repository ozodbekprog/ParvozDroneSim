"""Recover only missing packed foliage textures from already-authorized bundles.

Usage: bundled Python, PYTHONPATH=tools/bin/unitypy; pass an existing recovery
folder. UnityPy 1.25.4 (MIT) reads installed bundles; it never modifies them.
Existing source caches and .blend files are not overwritten.
"""
import gc, hashlib, json, pathlib, sys
from importlib.metadata import version
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION = '2022.3.62f3'

folder = pathlib.Path(sys.argv[1]).resolve()
resources = json.loads((folder / "resources.json").read_text(encoding="utf-8"))
manifest = json.loads((folder / "input-manifest.json").read_text(encoding="utf-8"))
output = folder / "foliage-pbr"
output.mkdir(exist_ok=True)
wanted = {}
for material in resources["materials"]:
    if not any(word in material.get("shader", "") for word in ["TreeCreator", "Tree Creator", "AFS/Foliage"]):
        continue
    source = json.loads((folder / material["file"]).read_text(encoding="utf-8"))
    for slot, env in source.get("m_SavedProperties", {}).get("m_TexEnvs", {}).items():
        if slot not in ["_BumpSpecMap", "_BumpTransSpecMap", "_TranslucencyMap"]:
            continue
        identity = str(env["m_Texture"]["m_PathID"])
        if identity != "0":
            wanted.setdefault(identity, []).append({"materialKey": material["key"], "name": material["name"], "shader": material["shader"], "slot": slot, "environment": env})
report = {"reader": "UnityPy " + version('UnityPy'), "textures": [], "missing": list(wanted)}
for bundle in manifest["bundles"]:
    if not report["missing"]:
        break
    environment = UnityPy.load(bundle["source"])
    for obj in environment.objects:
        identity = str(obj.path_id)
        if obj.type.name != "Texture2D" or identity not in report["missing"]:
            continue
        texture = obj.parse_as_object()
        file = "packed-" + identity + ".png"
        texture.image.save(output / file)
        digest = hashlib.sha256((output / file).read_bytes()).hexdigest()
        report["textures"].append({"id": identity, "name": texture.m_Name, "file": file, "sha256": digest, "width": texture.m_Width, "height": texture.m_Height, "format": texture.m_TextureFormat, "sourceBundle": bundle["name"], "materials": wanted[identity]})
        report["missing"].remove(identity)
        print(json.dumps({"recovered": texture.m_Name, "remaining": len(report["missing"])}), flush=True)
    del environment
    gc.collect()
    (output / "recovery.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
if report["missing"]:
    raise RuntimeError("Missing packed foliage textures: " + str(report["missing"]))
