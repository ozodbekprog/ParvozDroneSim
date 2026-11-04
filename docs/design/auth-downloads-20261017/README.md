# Authentication and downloads UI concepts — 17 October 2026

## User direction

The user rejects excessive explanatory copy, generic typography and unfamiliar
panel layouts. Functionality should be preserved. Start with authentication and
Downloads, show image concepts before a final design decision, then extend the
chosen direction to the remaining game interface. Primary input is desktop
mouse and keyboard (confirmed in chat).

The user selected **A — dark compact panels**, with desktop mouse/keyboard as
the primary input. Its authentication and Downloads implementation is now local;
this is not a deployment. The user subsequently saw real Sign in/Register/
Downloads screenshots and explicitly liked the compact dark implementation.
The current broader menu work is recorded in [MENU-SYSTEM-20261017.md](../../MENU-SYSTEM-20261017.md).
The earlier entry/fullscreen/download release remains pending as recorded in
ENTRY-DOWNLOAD-20261017.md. Do not publish its rejected UI unchanged as the
finished redesign.

## Common layout and copy decisions proposed for review

- Authentication: Sign in / Register tabs, Username and Password fields, one
  primary submit action. Keep password recovery and guest play as secondary
  links. Keep the existing username-based authentication; do not introduce email
  or third-party login. Preserve autofill, Enter submission and field errors.
- Registration uses the same familiar form layout with Create account as its
  primary action. Username/password requirements appear only when relevant to
  entry or validation, rather than as permanent paragraphs on Sign in.
- Downloads: map thumbnail/name, one state, progress and transferred size only
  while downloading, and only relevant actions. No permanent introduction,
  repeated file counts, or explanatory footer paragraph.
- Keep storage-unavailable and failure messages when a user needs to act.
  Move general storage/browser explanation into optional details.
- Downloads remain nonmodal. The user's later direction restricts their panel
  to Home; transfers continue across menu navigation and preserve Workbench
  drafts. Preserve queued transfers, cancellation, retained partial files,
  retry and reload verification. Do not invent speed/ETA/pause/delete controls.

## Visual alternatives

[Concept A](concept-a.png) · [Concept B](concept-b.png)

A: compact centered authentication dialog and compact lower-right Downloads
panel. Neutral charcoal, warm orange consistent with the current brand, normal
width humanist sans-serif (Source Sans 3 direction), small corner radius,
compact rows, restrained borders. More of the game remains visible.

B: left authentication sheet and full-height right Downloads drawer. Light cool
gray surfaces, dark text, restrained blue interaction accents, unchanged PARVOZ
brand, normal width humanist sans-serif (IBM Plex Sans direction), small corner
radius. Stronger separation of controls from the dark game environment.

Both concept boards use the same content and states to make comparison fair.
Illustrative progress/size values are not measurements. The generated mockups
must not be represented as implemented or tested game screens.
The short background main-menu list only establishes visual context. Existing
Career, Flight school, Weekly challenge and Replays entries are not being removed.
The existing password-recovery flow and all game functions remain in scope.

## Selected implementation and verification

Implemented A: a centered 390 px authentication panel, a lower-right 430 px
nonmodal Downloads panel, charcoal surfaces, warm orange actions, Source Sans 3,
small radii and concise labels. Font files are self-hosted, unmodified Adobe
assets under SIL OFL 1.1; their source and license accompany the files.

Sign in/Register tabs retain entered credentials and use the selected action on
form submission. Registration alone shows field requirements. Recovery and guest
play retain the existing handlers; pending requests disable all account controls.
The download panel keeps thumbnails, status, progress/transferred size only while
active, and relevant Download/Retry/Resume/Cancel actions. Browser storage details
are optional. A disappearing action moves keyboard focus to its replacement.
The transfer/cache logic and Workbench draft lifecycle are unchanged.

Verification on 17 October: production build passed; 18 focused tests passed
(account mode/keyboard/pending submission, request retry, download presentation,
queue/cancellation/retry/persistence/eviction/quota). Browser access still reports
`Local browser use is disabled in Work settings`. These tests do not substitute
for real form/autofill, layout, recovery, fullscreen or background-navigation
acceptance. Subsequent real screenshots are saved in
`data/ui-review-20261017/{sign-in,register,downloads}.jpg` and were shown in chat.
The user liked these and requested the same system for the other menus.

Next: inspect both forms and all download states at desktop/short viewport sizes,
exercise real sign-in/register/recovery/guest and background Workbench navigation,
then show actual game screens. The later all-menu direction is now explicit;
see the linked continuation. Do not describe generated boards as game evidence.

Generation method: built-in image_gen. Reference screenshots:
- docs/online-evidence-20261016/selected-luma-home.png
- docs/design/ui-audit-20261014/after/pilot-access.jpg

Exact prompts are retained alongside this brief in prompts.json and
corrections.json. Both generated images were visually inspected. The final A
removes the reference screenshot's debug counters; final B corrects its caption.
The visual direction is accepted; browser validation and Oracle publication remain
pending. The previous `20261017-entry-01` candidate predates this redesign and
must not be deployed as the selected result. Prepare a fresh candidate after
browser acceptance; preserve the earlier staging files for reference.
