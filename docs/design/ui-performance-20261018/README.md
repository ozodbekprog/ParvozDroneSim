# UI/performance browser evidence — 18 October 2026

Current online release: **20261018-ui-performance-04**, source **a469168**,
revision **c39594a402708803** / protocol 13. Full suite **443/443** passes.
Publication/backups: [Oracle](../../ORACLE-DEPLOYMENT.md).
Measurements and remaining work: [report](../../UI-PERFORMANCE-20261018.md).

All frames are actual game/browser captures. The loading gallery's source
images were exported at 1920×1080 / Ultra and have their own quality/GPU/camera
and SHA-256 metadata in src/assets/loading/captures.json. The menu/flight QA
frames below use the selected Low settings and do not establish UHD 620 FPS.

| Frame | What it verifies |
| --- | --- |
| [13: online loading](13-online-first-loading.jpg) | Real Ultra course image in the Russian loading screen |
| [14: profile](14-online-profile.jpg) | Fixed online panel; all three tabs measured 1080×672 |
| [15: Fly](15-online-fly-downloaded.jpg) | Shared Back style and Pine's independent Downloaded icon inside the preview |
| [16: rigid camera](16-online-pine-rigid.jpg) | Pine free flight with the separate centered rigid mode; dynamic mode also checked |
| [17: before repair](17-online-hangar.jpg) | **Bug evidence, not acceptance:** cached hidden Luma produced an invalid position and blank preview |
| [18: before repair locally](18-local-bounded-hangar.jpg) | **Bug evidence, not acceptance:** the same repeated-preview issue with Kestrel |
| [19: final online Hangar](19-online-final-hangar.jpg) | Luma visibly restored after repeated entry, final Russian UI; no captured console errors |
| [20: school](20-online-shared-school-status.jpg) | Pine's Downloaded state is shared with the lesson card; twelve lessons over three pages |
| [21: repaired local preview](21-local-restored-preview.jpg) | Kestrel visibly retained on the tabletop after repeated entries |

The final public repeated Minus Two/Luma entry took **1,055 ms including browser
commands**, waiting for `.hangar-stage[aria-busy="true"]` to disappear, then
visually confirming the model. Framebuffer 1040×585. This is a warm functional
check, not cold startup or target-hardware performance acceptance. Earlier
caption-only timings paired with blank frames are superseded.

Earlier local frames 01–12 cover Fly-first download behavior, reusable lesson
badges, help in Settings, language first run and ru/uz/en switches, profile
scrolling and Ultra material review. Dynamic/rigid Pine flight and both-map
two-client multiplayer were also verified online. The final browser tab is
left in the Russian Hangar with the original FPV preference restored and the
diagnostic overlay disabled.
