# Static stock aircraft thumbnails

The five `content/drones/*/thumbnail.png` files are the game's actual
256×144 transparent stock renders, saved from its existing rendered aircraft
cards on 15 October 2026. They use the same native models, stock parts and
runtime framing already visible to players; no new model extraction or
redistribution permission is implied.

Author of capture/render setup: Parvoz project. Original model authors,
sources and permission metadata remain in each aircraft's `SOURCE.json`
and the existing content import records. Aircraft: Kestrel, Luma 5,
Armattan Chameleon, Armattan Gecko, Dquad Addiction.

Original-aircraft cards now display these small images without loading five
additional aircraft and opening another WebGL context. Modified copies use
the stock picture as an immediate fallback while generating their own
customized thumbnail. The full inspection preview still shows actual
installed hardware. This reduces work and temporary memory on 4–8 GB PCs.
