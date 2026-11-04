# Parvoz: presentation for the team lead

24 October 2026. Requested deliverable: Russian PDF presenting the game's
capabilities, content, functionality, audience and market context. The user
clarified that this is for their team leader, not fundraising. Do not include
an investment ask or fabricate sales, users, revenue, partnerships or team roles.

## Completed decks after user selection

The user selected B (light business design), then explicitly requested **two
different nine-slide PDFs**, each with one heading and 3-4 short points, about
30-50 words per slide. One version highlights player-facing capabilities,
especially PID, physics, aircraft and public/private multiplayer. The other
follows the product/audience/content/market/development overview structure.
Both final decks use three main points and 32-36 words of body copy per page,
plus headings, evidence captions and necessary brief limitations.

- `output/pdf/Parvoz-01-Game-Features.pdf`: player-facing feature presentation.
- `output/pdf/Parvoz-02-Project-Overview.pdf`: project overview presentation.

The PDFs have embedded Cyrillic fonts, searchable vector text, real game
screenshots, nine bookmarks each, and clickable game/source links. PDF pages
were independently rendered with Poppler and all 18 inspected at 1280 x 720.
Extraction with pypdf verified every heading and all 54 main points against
the source. Both have exactly nine pages. No clipped text was observed.

Editable content, slide layout, per-slide sources and screenshot paths are in
`decks.mjs`. Artifact Session authored and rendered both decks. Its PDF exporter
failed first on unregistered embedded fonts, then the local export failed on
the bundled missing `#standard-fonts/Helvetica` module. No runtime dependencies
were modified. The final PDFs use `render-pdf.py` (ReportLab) with the same source
data and geometry, embedded Windows Arial fonts and original screenshot bytes.

To rebuild from the repository root using the bundled runtimes:

1. Run `prepare-pdf.mjs` with Node. It writes temporary shared content JSON.
2. Run `render-pdf.py` with Python containing ReportLab.
3. Render each PDF with Poppler, inspect pages and verify extracted text.

`PARVOZ_FONT_DIR` can override the directory containing arial.ttf/arialbd.ttf.
The script rejects text exceeding its allotted area. Temporary renders and
serialized session state are not part of Git history. Game files and Oracle
are unchanged.

## Earlier design alternatives

These previews preceded the user's selection of B. Keep them as design history.

- A: dark product presentation, balanced text/image layout (`option-a.png`).
- B: light editorial presentation, suitable for independent reading (`option-b.png`).
- C: large image, sparse text, suitable for spoken presentation (`option-c.png`).

`design-proposals.mjs` is the editable source. Run its `buildProposals(presentation)`
inside an Artifact Session presentation callback, then export the slides as PNG.
The three slides were rendered and visually inspected at 1920 x 1080.
The source screenshot is deliberately repeated to allow a
fair comparison, without invented game imagery.

## Evidence available for the full deck

Local catalog at source commit `61d7395`: 5 maps, 30 routes, 5 base drones,
5 challenges, 12 lessons. Maps and route counts: Hangar C03 (3), Liftoff Arena
(8), Pine Valley (6), The Green (7), Minus Two (6). Aircraft: Kestrel 5, Luma 5,
Armattan Chameleon, Armattan Gecko, Dquad Addiction. Customized copies are not
additional base models. Ironworks and historical generated maps are inactive.

Feature evidence: repository README; docs/MULTIPLAYER-ROOMS.md;
docs/DEMAND-PILOTS-20261023.md. Includes free flight, racing, precision,
freestyle, three-round championships, room chat/spectating, piloting lessons,
aircraft setup, accounts/progress, local replay playback and controller setup.
Angle/Horizon/Acro, keyboard, Gamepad API and compatible WebHID radios are
supported. Specific radio compatibility and physical accuracy still require
testing. Russian, Uzbek and English interfaces exist.

Published state must be described from the newest dated section of
docs/ORACLE-DEPLOYMENT.md: release 20261023-stability-03 is serving, four of six
after-release browser scenarios complete. This presentation work did not
revalidate the current server. Admission is 20 simultaneous multiplayer players,
rooms 2-8. Neither 100-player capacity nor UHD 620 at 60 FPS is accepted.
Start/Class variants are local only, with remaining UI acceptance. Local CSV
and assignment links do not constitute a cloud classroom or certification.

Screenshot provenance: src/assets/loading/the-green.jpg and captures.json.
Actual 1920 x 1080 Ultra game frame, not AI art. Source content: Liftoff: FPV
Drone Racing, LuGus Studios and credited content providers. Existing online-test
authorization does not establish commercial redistribution rights. Attribute
the imported test content visibly and preserve this distinction in the deck.

Other real screenshots already inspected: loading/pine-valley.jpg,
loading/minus-two.jpg, docs/design/ui-performance-20261018/09-ru-lessons.jpg and
19-online-final-hangar.jpg. The latter predates removal of separate action
cameras; use a newer Workbench capture for current aircraft appearance.

## External sources checked 24 October 2026

- https://www.velocidrone.com/shop : paid installed simulator, base license
  GBP 16.99 at check time. Price alone is not a market-size measure.
- https://store.steampowered.com/app/410340/Liftoff_FPV_Drone_Racing/ : established
  FPV simulator with racing, freestyle, multiplayer, customization and Workshop.
  Do not equate review count with active users or sales.
- https://flightdivision.com/ : free desktop browser FPV, lessons and
  keyboard/gamepad/radio support claimed by its developer. Browser access and
  beginner lessons are therefore not unique to Parvoz.
- https://skillbox.uz/course/ru/fpv-drone-piloting/ : marketed FPV course including
  simulator practice. Evidence of a local-language offer, not Parvoz demand.
- https://fenworks.com/drone-regional-2026/ : school simulator competition and
  real FPV program. Evidence of an educational use case, not a partnership.

Recommended market discussion: initial audience is novice desktop FPV users
in Uzbekistan and small clubs/teaching groups, with RU/UZ/EN language support.
Assess a hypothesis around understandable first exercises and local support.
Do not invent TAM/SAM/SOM or imply proven superiority. Product-market fit,
retention and payment conversion remain unmeasured.

No game/runtime/content files changed. No Oracle deployment is needed for
presentation-only work.
