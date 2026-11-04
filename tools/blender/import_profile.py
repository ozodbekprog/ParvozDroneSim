"""One shared configuration for recovery, Blender delivery and packaging."""
import json, os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PROFILE_PATH=Path(os.environ.get('CONTENT_IMPORT_PROFILE',str(ROOT/'tools/import-profiles/minus-two-demo.json')))
PROFILE=json.loads(PROFILE_PATH.read_text(encoding='utf-8-sig'))
RECOVERY=(ROOT/PROFILE['staging']).resolve()
if not RECOVERY.is_relative_to((ROOT/'data').resolve()):
    approved=PROFILE.get('cacheLocation')
    if not approved or RECOVERY!=Path(approved).resolve():raise ValueError('Recovery must stay within data/ or its explicitly configured cache junction')
MAP_FOLDER=ROOT/('content/shared-assets' if PROFILE.get('kind')=='prop-set' else 'content/maps')/PROFILE['id']
NODE_PREFIX=PROFILE.get('nodePrefix','Imported_'+PROFILE['id'].replace('-','_'))
