# Continuation — 14 October 2026

**Historical handoff, superseded on 15 October:** implementation, primary UI
review and Oracle publication completed. Read
[UI-NATIVE-CONTINUATION-20261015.md](UI-NATIVE-CONTINUATION-20261015.md) first.
The pending/blocking statements below describe the earlier session only.

The original request remains **unfinished**. Do not announce overall completion
from the passing tests, number of screenshots or staged archive.

## Latest reconnection progress

The user's ready reply restored the in-app Browser (Chrome still reported User
unavailable). New full-FHD captures verify Controls, Camera, Graphics, Career,
pilot access, stock Dquad, its Workbench and its Hypetrain 2306 motor swap on
Low. All saved frames were measured at 1920×1080. The capture rectangle is
the measured DOM size multiplied by the current DPR; viewport/DPR changed
again with panel visibility, so always remeasure. Windows scale was unchanged.

The last Gemfan propeller-selection action was **not executed**: automatic
approval review failed because the account usage limit was exhausted. Do not
switch automation methods to bypass it. Remaining browser checks are still
pending. A Dquad Copy 1 draft currently has unsaved Hypetrain 2306 motors;
resume from the observed UI state instead of creating another copy.

Oracle access now works from the recorded allowed IP 144.124.196.42; no ingress
change was needed. The current symlink is still 20261013-parvoz-01. A fresh
before-update backup was uploaded, independently downloaded and restore-tested
on VM and locally: users 4 / records 4 / career 0 / sessions 16 / achievements
3 / owned parts 0. SHA-256:
`4a0a661dc9a02278b6f936ae27632afda8d6eded00fa73100ea240a9c27ac633`.
Ignored local copy: `data/pre-native-cloud-20261014.sqlite`; VM copy:
`/home/liftoff/pre-native-cloud-20261014.sqlite`. Backup timer was active; no
active rooms; 14 GiB free. Logs: `data/oracle-pre-native-20261014.log`.

The reviewed delta archive and reconstruction script were uploaded to
`/home/ubuntu/oracle-patch-20261014-native-01.tar.gz` and
`/home/ubuntu/oracle-stage-native-20261014.sh`. The reconstruction script has
**not been executed** and the candidate has **not been activated**. It omits
the optional client host-key pin from the VM candidate, verifies each source
hash and preserves production/backup env byte-for-byte. Reverify backup freshness
before actual activation; do not rerun a completed backup script that refuses
to overwrite its verification copy.

## Verified and saved

- Loading/scene reuse repair: `e1d8dac`, pushed and remote SHA matched.
- Tests read retired Ironworks from its ZIP: `de90028`, pushed. No restoration.
- Gecko, Dquad, native components and shared physics: `edd3147`, pushed with
  23 LFS objects / 221 MB; remote SHA matched. Kestrel preserved; generated
  Swift/Atlas/Viper disabled; retired saved builds retained.
- Pilot markers, live chat discovery and Workbench UI: `4403b40`, pushed and
  remote SHA matched. Final browser acceptance of these changes is pending.
- Final full suite: **235 passed**, zero failures/skips. Log:
  `data/full-tests-20261014-final.log`.
- Local two-client Gecko/Dquad transport smoke passed:
  `data/native-two-client-smoke.log`. This is not visual proof of nameplates.
- Candidate independently built and content-validated:
  `data/oracle-release-20261014-native-01/`, protocol **10**, revision
  **9a0ff4f715bbd733**, 3 maps / 17 routes / 5 aircraft / 36 part records /
  71 unique delivery URLs. Existing map exports and caches were reused.
- Delta archive `data/oracle-patch-20261014-native-01.tar.gz`: **197,744,421
  bytes**, SHA-256
  `b0fe2afd8086995e63e7d85d2a3800fb9b52cfef7c6bc9e610795a2233b8cc8e`.
  Inventory: 111 changed files, 334 reused files. No DB/env/keys/Blender sources
  are in this VM delta. Editable Blender files are preserved in Git LFS.

## Screenshot correction and remaining work

The five user-reported frames 29/31/35/36/37 were replaced with full FHD
captures. A subsequent audit found additional stale/unfinished frames. The
[gallery](design/ui-audit-20261014/gallery.html) and
[manifest](design/ui-audit-20261014/manifest.json) explicitly exclude them;
the three-perspective [audit](design/ui-audit-20261014/README.md) is partial.
Do not count files as complete coverage or stretch cropped frames to FHD.

Windows remains at 150%. Browser contexts had different DPI/capture behavior.
For each context measure DOM, capture size and all four image edges again.
One local context worked with measured DOM 1920×1080 and capture rectangle
1536×864 producing the complete 1920×1080 page; this is context-specific,
not a universal scale rule. Do not change Windows settings.

Finish actual Preparing flight/Results and missing menu/dialog retakes; inspect
Dquad and remaining component swaps at Low from multiple angles; fly both new
aircraft; verify two-client markers/chat and cold versus warm map/route/garage
transitions. F4 starts the existing fixed-1280×720 Low measurement, F6 exports.
Do not claim UHD 620 performance from this computer.

## Current blockers and publication

The Computer/Browser connection repeatedly returned **User unavailable** after
the last interruption. The user has been asked to reconnect and reply ready.
Do not replace CUA with another browser automation method to bypass this.

Known Oracle SSH key remains at `D:/Downloads/ssh-key-2026-10-04.key` (never
print/copy it into Git). Known-hosts file: `deploy/oracle-known-hosts`. SSH
to 84.8.106.32 timed out. The current ipify result was **195.158.3.42**,
different from the recorded approved source **144.124.196.42/32**. Recheck
the current IP and actual console row; changing ingress requires explicit
action-time approval. No firewall change has been submitted for this task.

Oracle is **not updated**. Public catalog still reports protocol **9**, revision
**4233a00856896de1**, 6 drones / 55 assets; admission **20**. `/api/rooms`
responded with no rooms and limit 20 during the latest read-only check. One
full `check-public` attempt timed out, so do not claim fresh full public
verification from that attempt. No production backups, DB or env were changed.

Once access and visual checks are available, use the reviewed delta to create
a fresh VM release directory, verify all reconstructed hashes, copy existing
env files byte-for-byte, take and restore-test fresh cloud backups, drain rides,
retain rollback image/directory, deploy protocol 10 client/server together,
verify affected public scenarios and 20-player admission, then switch current.
Update ORACLE-DEPLOYMENT with actual publication/backup results. Do not rerun
old registration, extraction, art exports, completed October-13 deployment
scripts or full unchanged-asset uploads.
