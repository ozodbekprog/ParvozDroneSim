# Render resolution control - 23 October 2026

Implemented in Settings > Graphics, using the existing settings screen and
`liftoff-graphics-v1` browser storage. The old 50–125% range now supports
**30–125% in 1% steps**, with **30%, 50%, 75%, 100%** shortcut buttons. The
Russian label is «Разрешение рендеринга»; English and Uzbek are also translated.

Manual selection switches quality to Custom and disables adaptive resolution,
including its visible checkbox, so the requested percentage remains fixed.
Other quality choices, aircraft tuning and account data are preserved. The
player can explicitly enable adaptation again. Presets still use their existing
65/85/100% values. Invalid saved scale values are bounded before use.

The renderer changes the 3D canvas framebuffer, while the HTML menus/HUD retain
their normal size and sharpness. An adjacent output reports actual pixel
dimensions, including after resizing or adaptation. Percentages retain the
existing device-pixel-ratio behavior; fixed 1280x720 acceptance runs still take
precedence and are unchanged.

Verification: **20/20** focused graphics, persistence, framebuffer, surface and
localization checks pass; production build passes. Actual local browser checks
on the same viewport show **1345x756 at 100%**, **672x378 at 50%** and
**403x226 at 30%**. Selecting 30% after enabling adaptation unchecks it. The
settings panel remains sharp. These checks establish functionality, not a
target-hardware FPS gain or public acceptance.

[Actual settings screenshot](design/render-resolution-20261023/settings-30-percent.png).

Publication is pending: public HTTPS/API/WebSocket/asset checks still pass on
the existing release, but the SSH connection to the deployment VM timed out on
23 October. No firewall or access rule was modified. No release was activated,
no production data touched, and no new backup/finalization script was run.
Resume by restoring the authorized narrow SSH access, retrieving the current
VM manifest, and preparing a fresh code-only release with read-only canonical
sources. Do not rerun the completed cold-start deployment helpers.
