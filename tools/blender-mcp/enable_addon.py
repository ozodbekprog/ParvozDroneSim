"""Enable the installed MCP addon without changing an authored scene."""
import json
import shutil
from datetime import datetime
from pathlib import Path

import addon_utils
import bpy

backups = Path(__file__).resolve().parents[2] / "data" / "blender-mcp-backups"
backups.mkdir(parents=True, exist_ok=True)
preferences = Path(bpy.utils.user_resource("CONFIG", path="userpref.blend"))
if preferences.exists():
    shutil.copy2(preferences, backups / (datetime.now().strftime("%Y%m%d-%H%M%S") + "-userpref.blend"))

addon_utils.modules(refresh=True)
addon_utils.enable("blender_mcp", default_set=True, persistent=True)
if "blender_mcp" not in bpy.context.preferences.addons:
    raise RuntimeError("Blender MCP did not register")
bpy.context.preferences.addons["blender_mcp"].preferences.telemetry_consent = False
bpy.ops.wm.save_userpref()
print("BLENDER_MCP_SETUP=" + json.dumps({
    "enabled": True,
    "blender": bpy.app.version_string,
    "preferences": str(preferences),
    "addons": bpy.utils.user_resource("SCRIPTS", path="addons"),
}))
