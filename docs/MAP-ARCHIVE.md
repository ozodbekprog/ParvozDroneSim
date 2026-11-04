# Archived generated maps

Twelve earlier generated environments were removed on 2026-10-10. Ironworks v2
was retired on 2026-10-13 at the user's request. Active local maps are Minus Two,
Hangar C03 and Liftoff Arena. The user-authorized Oracle online multiplayer test
now includes these three maps; see ORACLE-DEPLOYMENT.md for publication checks.

Ironworks ZIP: `backups/ironworks-v2-20261013.zip`, with SHA-256 beside it.
Every archived file was verified inside the ZIP. Extract its `ironworks-v2`
folder into `content/maps/`, then run `npm run build`. The folder includes both
courses, both missions, editable source and the local-only garage dependency.
One-folder restoration passed; its result is retained in
`data/ironworks-restore-check-result-20261013.json`. During 13 October cleanup,
expanded archive/restore copies were compared against every ZIP entry and
removed. The distinct older `data/removed-maps/ironworks-v2-original/map.json`
and separate old course/mission definitions remain; matching model/source
duplicates were removed. No accounts or progress database are included or
removed. Its Liftoff garage must remain local.

The twelve older generated maps live in `content/archived-maps/<map-id>/`.
Ironworks uses the ZIP above. Each older map contains the original model/textures,
`original-map.json`, verified SHA-256 inventory, and original courses/missions/
lessons under `.archive-content/`. Its editable `map.json` bundles the gameplay
definitions so one folder restores the whole map.

To restore a map, copy its entire folder into `content/maps/<map-id>/`, then run:

```powershell
npm run content:sync
```

The local editor/server detects content changes. For the built game, run `npm run build` and restart the local server; publishing to Oracle remains a separate release. Existing records and player progress have not been deleted. A replay of an archived map requires restoring that map.

Do not copy `.archive-content/` into the global races/challenges/tutorials directories: the bundled definitions already install them. The backup remains available after restoration.
