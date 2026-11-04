# Pine Valley and The Green: browser checks, 18 October 2026

Both complete imported environments were opened in the actual Parvoz renderer.
The review used WebGL2, Low, a fixed 1280×720 framebuffer and disabled adaptive
resolution. These checks establish functional rendering, not UHD 620 performance
or the user's artistic acceptance.

## Functional checks

- Both maps load with native terrain, vegetation, course props and gate geometry.
  Pine's repaired foliage cutouts remain transparent in the browser.
- Kestrel takes off, holds position and lands on each map. The review's landing
  button cuts throttle: its two-metre drop leaves health 0.969, without a crash.
  It is a contact check, not a demonstration of a gentle player landing.
- Course camera tours, start/reverse/near-drone views and full-screen captures work.
- Both introductory lessons start through Flight school, show the target marker,
  speed ceiling and continuous hold timer, and return through Pause / Exit flight.
  Flight mode follows the player's saved setting; M cycles it. No claim is made
  that every lesson was manually completed in this browser session.
- Both outdoor workshop placements load. Kestrel's editable copy rests on the
  retained native tabletop; selection, inspection and Workbench navigation work.
- Flight setup lists all five Pine and six Green native courses with authored
  names and lap counts. Flight school shows twelve lessons across three pages.
- No warnings/errors were captured in the inspected browser logs.

## Measured rendering cost

| View | Triangles | Draw calls | Reported resident texture estimate |
|---|---:|---:|---:|
| Green, start inspection | 745,041 | 543 | 46.5 MiB |
| Green, stabilized hover | 841,823 | 542 | 46.5 MiB |
| Green, maximum sampled on course tour | 1,575,768 | 730 | 46.5 MiB |
| Pine, start inspection | 4,359,696 | 2,298 | 28.4 MiB |
| Pine, stabilized hover | about 4,235,000 | about 2,206 | 28.4 MiB |
| Pine, one sampled point on course tour | 429,786 | 380 | 28.4 MiB |

Peaks are maxima over observed frames, not a guarantee of the maximum everywhere.
The texture estimator does not establish the complete GPU allocation budget.
Frame time and FPS were not accepted on target hardware.

The existing Low LOD selection and 180-metre draw distance work. Delivery levels
deliberately preserve source geometry, so LOD switching does not sufficiently
reduce dense vegetation. The diagnostic `&stats=1` review identifies individual
fern batches above 100,000 submitted triangles at Pine's start. Both maps exceed
the preliminary 150–300k / 250-call budget. Further vegetation LOD/batching work
and an actual UHD 620 measurement remain necessary; the online release is a
functional multiplayer test, not a performance sign-off.

## Real thumbnails

The map-card thumbnails are unedited screenshots of the same game renderer,
captured full-screen at stabilized hover. No generated or Blender-rendered
image substitutes for these game views. SOURCE.json records the capture and
retains the proprietary permission metadata unchanged.

![Pine Valley](../content/maps/liftoff-pine-valley-demo/thumbnail.png)

![The Green](../content/maps/liftoff-the-green-demo/thumbnail.png)

Additional local HUD, school, workshop and profiling evidence remains in the
ignored task directory `data/liftoff-forest-green-20261018/`. Publication status is
recorded separately in [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md).
