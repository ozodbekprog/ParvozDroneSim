"""Read a scene through the installed server's actual MCP stdio transport."""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[2]
UVX = r"C:\Users\User\AppData\Local\Programs\Python\Python314\Scripts\uvx.exe"
PYTHON = r"C:\Users\User\AppData\Local\Programs\Python\Python313\python.exe"


async def check():
    parameters = StdioServerParameters(
        command=UVX,
        args=["--python", PYTHON, "--from", "mcp-for-blender==2.1.3", "mcp-for-blender"],
        env={**os.environ, "BLENDER_HOST": "127.0.0.1", "BLENDER_PORT": "9876", "DISABLE_TELEMETRY": "true", "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
    )
    async with stdio_client(parameters) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            initialization = await session.initialize()
            tools = await session.list_tools()
            names = [tool.name for tool in tools.tools]
            if "get_scene_info" not in names:
                raise RuntimeError(f"Scene inspection tool missing: {names}")
            result = await session.call_tool("get_scene_info", {
                "user_prompt": sys.argv[1] if len(sys.argv) > 1 else "Проверить подключение Blender MCP."
            })
            if result.isError:
                raise RuntimeError(str(result.content))
            scene_text = "\n".join(item.text for item in result.content if item.type == "text")
            scene = json.loads(scene_text)
            if "object_count" not in scene:
                raise RuntimeError(f"No scene object count returned: {scene}")
            report = {
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "server": initialization.serverInfo.model_dump(mode="json"),
                "toolCount": len(names),
                "scene": result.model_dump(mode="json"),
            }
            destination = ROOT / "data" / "blender-mcp-connection.json"
            destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps({"connected": True, "server": report["server"], "toolCount": len(names), "objectCount": scene["object_count"], "report": str(destination)}))


asyncio.run(asyncio.wait_for(check(), timeout=55))
