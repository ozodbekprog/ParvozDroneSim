# Repository presentation

[Project overview](../../README.md) · [Русская версия](../../README.ru.md) ·
[Documentation index](../README.md)

The README presents the existing Parvoz web beta. It uses the project's accepted
mark and real game captures. The [MiroFish README](https://github.com/666ghj/MiroFish)
supplied by the user informed the hierarchy: identity, demo link, gallery,
overview and setup. Its copy and artwork are not reused.

## Visual choices

- Palette follows the game: charcoal `#181b20`, off-white `#f5f2ed`, warm orange
  `#eea462`, secondary text `#b8bec6`, rule `#343941`.
- Barlow Condensed carries the PARVOZ wordmark; DM Sans carries supporting copy.
  Both are existing project font dependencies. Letterforms are outlined inside
  the SVGs so GitHub needs no external font files. Original copyright and OFL
  notices: [Barlow](LICENSE-Barlow.txt), [DM Sans](LICENSE-DMSans.txt).
- The cover pairs the wordmark and the accepted flowing quadcopter. A compact
  status strip identifies beta, renderer support and interface languages.
- GitHub's own typography handles the body. A two-column gallery groups actual
  views, and technical operations live in the separate developer guide.
- `cover.svg` and `status.svg` are self-contained editable vectors with accessible
  titles/descriptions. No external image, font, script or badge service is used.

## Capture sources

Images are linked in place, without copying or retouching them. They show the
recorded build/settings at capture time, not a promise of frame rate or final art.

| README view | Source | Capture context |
| --- | --- | --- |
| The Green | [Existing game-rendered loading capture](../../src/assets/loading/the-green.jpg) | In-game route view, already bundled with the 17 October menu update; no HUD |
| Hangar | [Online final Hangar](../design/ui-performance-20261018/19-online-final-hangar.jpg) | Public beta, 18 October; Luma saved-copy selection |
| Workbench | [Public Workbench](../design/ui-polish-20261015/24-public-workbench.png) | Public beta, 15 October; Armattan Gecko motor options |
| Flight school | [Russian lessons](../design/ui-performance-20261018/09-ru-lessons.jpg) | Local implemented UI, 18 October; twelve-lesson menu |

Original verification notes: [15 October](../design/ui-polish-20261015/README.md),
[17 October](../design/menu-system-20261017/README.md),
[18 October](../design/ui-performance-20261018/README.md).
Imported-resource provenance and permission metadata remain in canonical
`content/` packages. This documentation update changes neither those permissions
nor repository visibility.

## Repository metadata

[`repository.json`](repository.json) records the GitHub About description,
game URL and topics applied with this update. The repository remains private.
No game runtime or Oracle deployment changes are part of this presentation work.

## Verification

Both language versions were rendered with GitHub's Markdown API. Each retains
six accessible images (cover, status strip and four captures), four tables and
the intended links. All relative image/document paths and section links in the
five edited guides were checked. The SVGs were parsed and rasterized for visual
review. Live browser preview was unavailable because Browser Use is disabled;
no browser screenshot or full-page visual acceptance is claimed.
