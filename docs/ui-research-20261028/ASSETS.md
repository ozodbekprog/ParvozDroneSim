# Источники и лицензии

## Реальный фон

`prototype/assets/hangar.png`: снимок **текущей локальной сборки** игры,
сделан 28 октября 2026 через Chrome/Computer Use. Это не AI-изображение.
Источник — `http://127.0.0.1:2572/`, отдельная тестовая база
`data/ui-reference-20261028/db`; клиент `index-C6kry7tX.js`.
Мастерская Luma 5 Copy 1 в гараже Minus Two. Создана только тестовая локальная
копия Luma, детали и настройки полёта не менялись.

Фон — прямой `Page.captureScreenshot`, 1920×1080 PNG. Перед захватом временно
скрыты UI-соседи `#viewport` через `visibility:hidden`; размеры сцены и camera
не менялись этим стилем. После захвата стиль удалён. Изображение не кропалось,
не ретушировалось, не перекрашивалось и не улучшалось генератором.
`evidence/current-workbench-1920.png` показывает исходную мастерскую с UI.

Первоначальная попытка публичной версии с обходом HTTP-cache/service worker
застряла на подготовке; она не выдана за готовый кадр. Публичный клиент в той
попытке — `index-OPei9JC_.js`. Временные cache/SW/focus overrides сброшены,
публичная тестовая вкладка закрыта. Пользовательские вкладки/базы не менялись.

Исходный контент гаража и Luma — Liftoff: FPV Drone Racing, LuGus Studios и
правообладатели по сохранённой provenance проекта. Действует разрешение на
согласованный тест; новые права на распространение не заявляются. Репозиторий
остаётся приватным. Фон предназначен для обсуждения UI этого проекта.

## Компоненты

Web Awesome Core 3.14.0, Fonticons Inc., MIT:
https://webawesome.com/ . Точный registry tarball/integrity в отдельном
`prototype/package-lock.json`; копия лицензии —
`prototype/assets/Web-Awesome-LICENSE.md`. Использованы свободные Button/Details,
без Pro-тем, платных компонентов или подписки.

## Шрифт и знак

- Source Sans 3, Adobe / Paul D. Hunt, SIL OFL 1.1,
  https://github.com/adobe-fonts/source-sans , commit
  `87b37a2daaed80fcb8e8ccb0085c4d72ddade12e`. Regular/Semibold скопированы
  без изменения из `src/assets/fonts/source-sans-3/`; лицензия рядом.
- `parvoz-mark.svg` — существующий знак проекта из `src/assets/parvoz-mark.svg`.
  Не новый предложенный логотип.
- `previews/01.png`, `02.png`, `03.png` — browser screenshots HTML-макетов
  поверх одного `hangar.png`; UI — работа этого этапа. Image Gen не использован.

Hash/размеры изображений — `image-inventory.json`. Проверка неизменности
центральной области исходного фона — `background-proof.json`.
