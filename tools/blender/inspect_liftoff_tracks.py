import json,sys,collections,xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from import_profile import RECOVERY
folder=RECOVERY/'source-tracks'
tracks={}
for path in folder.glob('*Track*.xml'):
    root=ET.parse(path).getroot();items={b.findtext('instanceID'):b for b in root.find('blueprints')}
    tracks[root.findtext('localID/str')]=(path,root,items)
for path in folder.glob('*Race*.xml'):
    race=ET.parse(path).getroot();track=tracks[race.findtext('dependencies/dependency/str')]
    passages=list(race.find('checkPointPassages'))
    details=[]
    for passage in passages[:5]:
        item=track[2][passage.findtext('checkPointID')]
        details.append({'id':passage.findtext('checkPointID'),'type':passage.findtext('passageType'),'direction':passage.findtext('directionality'),'item':ET.tostring(item,encoding='unicode')[:1400]})
    print(json.dumps({'race':race.findtext('name'),'laps':race.findtext('requiredLaps'),'spawn':race.findtext('spawnPointID'),'passages':len(passages),'items':len(track[2]),'types':dict(collections.Counter(b.findtext('itemID') for b in track[2].values())),'examples':details},indent=2))
