# Offline antenna assembly review

19 October 2026. Front/rear Cycles renders of saved Chameleon/Dquad Blender
sources with their source antenna PartSlot/SnapPoint matrices. Both viewpoints
were inspected. These are not in-game Low screenshots or Workbench UI acceptance.

![Chameleon rear](armattan-chameleon-AntennaPagodaCircular01-rear.png)
![Chameleon front](armattan-chameleon-AntennaPagodaCircular01-front.png)
![Dquad rear](dquad-addiction-AntennaSoupape01-rear.png)
![Dquad front](dquad-addiction-AntennaSoupape01-front.png)

Native meshes/materials: LuGus Studios and original credited manufacturers;
proprietary content, redistribution permission unconfirmed. See the canonical
`content/shared-assets/liftoff-antennas/SOURCE.json`. Editable antenna art is
`parts.blend`; reviewed aircraft sources were not overwritten. Review script:
`tools/blender/review_native_antennas.py`.

## Actual local game checks

Browser access restored later on 19 October. IAB 1076x606, existing Russian UI,
isolated local guest/data directory; Oracle unchanged. Source is b2a4ace plus
the part-list flex correction. These are interface/geometry checks, not FPS or
formal Low/target-hardware acceptance.

The part list initially measured 0 px height; after retaining its content size
it measures 287 px and the parent panel scrolls. Chameleon Fatshark selection
survives saving, reopening and client reload. Gecko's actual loaded imported
antenna node has visible=false; the temporary visibility probe is removed from
the client. Its recorded result is in `browser/gecko-render-visibility.json`.
Luma offers Soupape Micro only; Dquad offers four antennas and its lower cards
can be selected and scrolled into view. Luma appearance has no action-camera
control. Gecko camera offers only Redot Split Mini.

![Saved Chameleon selection](browser/chameleon-fatshark-saved.png)
![Gecko native blank slot](browser/gecko-forced-blank.png)
![Luma whitelist](browser/luma-native-whitelist.png)
![Dquad lower selection and scrolling](browser/dquad-native-selection-scrolled.png)
