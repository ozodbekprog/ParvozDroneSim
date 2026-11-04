# Graphics switching regression — 2026-09-28

## Confirmed failures

- The motion-blur MRT changed between one and two color attachments. GPU validation reported an incompatible pipeline/attachment layout and rejected the frame.
- The previous-position path used by motion blur did not represent the forest's instanced trees correctly. Stationary trees were smeared into the background even with AO disabled.
- Changing shadow resolution after allocation could leave bindings using destroyed `ShadowMap`/`ShadowDepthTexture` resources. This was reproduced through the actual pause/Graphics menu.
- Map cleanup disposed Three.js's shared Sprite geometry. The next map's sun could submit a destroyed vertex buffer.

## Fixes

`src/camera-motion-blur.js` reconstructs surface motion from depth and camera history, limits shutter duration and blur distance, rejects samples across silhouettes, and clears history on discontinuities. The scene retains a single color attachment. This is camera motion blur; it does not add independent object-motion blur.

`src/shadow-settings.js` configures the initial shadow size before allocation and replaces an allocated sun light when changing its shadow resolution. The new light keeps its lighting/shadow parameters and forces fresh bindings. Sprite geometry remains owned by Three.js instead of individual maps. Models have not been changed.

## Focused checks

- Six Node tests: stationary/moving reprojection, discontinuities, stable shadow targets, initial allocation, and shadow replacement. Run `node --test --test-isolation=none test/camera-motion-blur.test.js test/shadow-settings.test.js`.
- Local developer page: `http://127.0.0.1:2570/editor/render-check.html`. **Check effect switching** runs seven combinations with Ultra/Custom shadow changes against the same scene and renderer. It reads real GPU pixels, checks validation errors and compares stationary motion-blur output with the sharp baseline. This page uses its own settings and does not save player preferences.
- Chrome WebGPU checks on Mossline, Nocturne and Afterlight: all combinations passed; stationary blur pixel difference was zero. A Chrome WebGL2 Mossline check also passed.
- Actual game: Mossline → Pause → Graphics → disable both effects → Back → Continue retained the scene without reloading. A second Ultra → disable AO → Custom transition also retained the scene. Screenshots: `chrome-mossline-effects.jpg` and `chrome-mossline-effects-off.jpg`.
- Production build passed. Extended flight, hardware and device testing remains with the player.
