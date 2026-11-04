# Инструкция для ИИ: карты, трассы и задания

## Материалы, объекты трасс и настройки графики

Обновлено 2026-10-10. Перед подключением новой карты проверять **используемые** материалы в конечном GLB, а не только успешность экспорта. `materialsCheck` сравнивает alpha, MASK/BLEND, normal, metallic/roughness и AO с исходником; неизвестный шейдер или потерянный texture slot блокирует `package`. `trackMaterialsCheck` проверяет материалы всех готовых моделей трасс. Сохранять имя исходного шейдера и явный адаптер в `materialAdapters` профиля. Unity-код шейдера автоматически не переносится в браузер.

- Unity Standard `_Mode=1` → MASK с `_Cutoff`; 2/3 → BLEND с `_Color.a`, включая материалы без albedo-текстуры. Проверять стекло на фоне объектов, с обеих сторон и на каждом LOD. Не превращать стекло в непрозрачные vertex colors на дальнем уровне.
- `_BumpMap` → normal map в Non-Color; `_MetallicGlossMap` R/A → glTF metallic B / roughness G; `_OcclusionMap` использовать с правильным каналом. Проверять tint, emission, UV scale/offset и направление normal maps.
- `_DetailAlbedoMap` / `_DetailNormalMap` восстанавливать и запекать в браузерные текстуры. Поддерживается UV0; UV1 требует отдельного запекания и явной остановки, а не пропуска слоя. Detail mask требует отдельной обработки. Для готового кэша предусмотрен `details`, затем `textures`.
- В Minus Two `WheelStop01` использует `Shader Forge/StandardTriplanarWorldSpace`: адаптирован к PBR с авторскими UV; смешивание исходной world-space triplanar-проекции приблизительно. PulsatingOutline у удалённого персонажа и Additive у исключённого Rainbow в доставляемой карте не используются. Не объявлять все произвольные Unity-шейдеры поддержанными.

Трасса — это весь список `TrackBlueprint`, включая ограждения, конусы, ленты, шины, указатели и световые элементы. Не ограничивать импорт checkpoint ID. Сопоставлять prefab через Addressables internal GUID → AssetBundle `m_Container.m_Asset`: одноимённый GameObject может быть вложенным объектом или другим префабом.

Для трасс с сохранёнными XML: `gateConfig` → `trackAssets` → `trackTextures` → `tracks` → `trackModels` → `trackOptimize` → `trackCollisions` → `markers` → `sync` → проверки → `build`. `--loaded` у `gateConfig` использует уже загруженную собственную сессию. `tracks` пересоздаёт race JSON; после него необходимо вернуть описание моделей/коллизий. `trackCollisions` исправляет только коллизии без повторного экспорта визуальной геометрии.

Сохранять отдельный `track.blend` и `props.glb` в пакете каждой гонки. Размещать модели через `race.objects`; загружать только объекты выбранной трассы. Сохранять исходные LODGroup: одновременно виден один уровень, пространственные участки отсекаются независимо. Никогда не рисовать все исходные LOD вместе. Исходные checkpoint volumes и repair/charge/spawn helpers не должны становиться твёрдыми препятствиями; реальные не-trigger коллизии ограждений сохранять для клиента, SoloSession и сервера. Скрипты ремонта/зарядки Liftoff не импортируются; это явно записывать в SOURCE.

В графических настройках доступны `lodDistanceScale` (0.25–4), отражения, normal maps и максимальный размер текстур (256/512/1024/2048/исходный). Масштабировать расстояния, не transforms/коллизии. При уменьшении KTX2 выбирать младшие mip-уровни и освобождать прежнее GPU allocation; при повышении восстанавливать исходные данные без новой загрузки. Размер не может превысить реальный импортированный источник. Проверять обе стороны переключения и фактическую оценку памяти, включая обычные PNG. Отражения используют один статический PMREM capture при подготовке сцены; отключение освобождает capture, непрерывные cubemap captures в полёте не нужны.

Сравнивать Low и улучшенный вариант с одинаковой камерой. Проверять стекло, окрашенный металл, normal detail, маркировку пола, emissive-свет и перезапуск каждой трассы. Проверять бюджеты с дополнительными объектами выбранной трассы; общий размер всех LOD в файле не равен видимым треугольникам. FPS на другой машине не подтверждает UHD 620.

Перед `assemble` **сделать копию существующего `.blend` и сверить SHA256**, даже если планируется восстановление из кэша. Проверять свободное место до сборки: собственная сессия AssetRipper удерживает много временных распакованных данных. После извлечения остановить только её процесс и освободить временные данные; не удалять общие Temp-каталоги, исходники, кэш восстановления или пользовательские файлы. `assemble --no-render` пропускает необязательный Blender preview render; визуальная проверка в игре остаётся обязательной.

Для быстрого продолжения сначала прочитать [AI-QUICKSTART.md](AI-QUICKSTART.md): состояние работы, кэши и выбор минимальных этапов. Здесь — подробности для конкретного этапа.

Этот файл описывает повторяемый локальный импорт. Прочитай его перед следующей задачей по картам. Сначала прочитай актуальный AGENTS.md и `ORACLE-DEPLOYMENT.md`, `FREE-HOSTING.md`, `WEB-BETA.md`. Последняя просьба пользователя: сначала показать результат локально; Oracle пока не обновлять.

## Быстрый вход

После исправления дыр 9 октября 2026: **не применять COLLAPSE/процентный Decimate к разрезанной на ячейки импортированной сцене**. Это удаляло поверхности (1217 / 3561 пропусков в двух LOD). В Minus Two включён `lod.preserveGeometry`: LOD меняет группировку материалов, сохраняя форму. `planarDissolve` объединяет только копланарные грани, сохраняет границы и UV; результат обязан пройти `geometryCheck`. В `map.blend` остаётся исходная полная сетка.

Оптимизация получает `--unity-materials=<browser-resources.json>`: Unity `_Mode=1` сохраняется как glTF MASK с исходным cutoff. Плоские blend-наклейки получают metadata `singlePassThinSurface`; renderer рисует их одним проходом с обеих сторон. Не применять этот флаг к объёмному стеклу и не снижать счётчики скрытием нужных стен или полов.

Рабочий пример: `tools/import-profiles/minus-two-demo.json`. Все этапы читают один профиль через `CONTENT_IMPORT_PROFILE`; оболочка устанавливает его сама. Исторические имена скриптов `minus-two` сохранены, но источник, каталоги, ID, камера, LOD и сценарии теперь задаются профилем.

```powershell
node tools/import-game-content.js tools/import-profiles/minus-two-demo.json --step=plan
```

По умолчанию команда лишь показывает этапы. Вызывай конкретный этап; не запускай всё заново, если восстановленные данные уже есть. Это экономит время, диск и контекст ИИ. Журналы и промежуточные файлы находятся в `data/<отдельный-каталог>/`; игровые пакеты — в `content/`.

## Новая карта

Скопируй профиль в `tools/import-profiles/<новый-id>.json`. Измени:

- `id`, уникальный `nodePrefix`, отдельный `staging` внутри `data/`.
- `source`, `catalogPath`, `bundlesPath`, `roots`. Первым root должна быть сцена `.unity`, затем её нужные конфигурационные ресурсы.
- `map`: имя, описание стороннего содержимого, окружение и свет.
- `probe`: позиция и цель камеры в координатах игры, радиус небольшого участка.
- `lod`: размер ячеек, коэффициенты упрощения, дистанции и минимум для Low. `texturedFarMaterials` содержит фрагменты названий материалов, которым необходимо оставить UV на дальнем LOD. Начинай с пола; слишком много сохранённых материалов повышает draw calls.
- `course`: свой spawn, границы поиска `[minX,maxX,minZ,maxZ]`, высота пола и проходов, точки маршрута `[x,z]`, размеры ворот, уникальные ID гонки и учебной трассы.
- `tutorial`, `challenge`: уникальные ID, названия, цель, награда и подсказки. `tutorial.steps` можно задать явно; иначе создаются взлёт, учебные ворота и посадка.
- `provenance`: реальный автор, исходная ссылка, лицензия и подтверждённые условия. Не приписывай чужим ресурсам CC0. Техническое извлечение не устанавливает права на использование.

`excludeObjectPrefixes` удаляет целые исходные иерархии, включая потомков и коллизии. Этап **exclusions** выполняется перед **collisions** и **assemble**. Это используется для Christmas/Halloween/Easter/Valentines, Snowman, Heart, GoldenEgg, PotofGold и других праздничных объектов. Не вычищать отдельные полигоны вручную.

Адаптер `liftoff-unity-2022` проверен на Minus Two из Unity 2022.3.62f3. Это не универсальный импортёр любых игр: другие версии Addressables, шейдеры, terrain, skinned meshes, lightmap formats и динамические объекты могут потребовать доработки. Не объявляй другую карту восстановленной до проверки её ресурсов.

## Этапы восстановления

1. **inputs**: разобрать Addressables и выбрать только граф зависимостей сцены. Оригинальная установка читается без изменений.
2. Запустить официальный AssetRipper Free 2.0.0 на адресе из профиля. Проверенный локальный запуск:

   ```powershell
   tools/bin/assetripper-2.0.0/AssetRipper.GUI.Free.exe --headless --port 2576 --log-path data/assetripper.log
   ```

   Подготовь достаточно свободного временного диска. Для Minus Two потребовалось около 13.4 GB распакованных данных; диск C первоначально переполнился. При переносе TEMP/TMP используй отдельный каталог вне установки игры. У AssetRipper нет необходимости экспортировать все игровые скрипты.
3. **inputs --load**: передать выбранные bundles в `/LoadFile`. Загрузка может длиться десятки минут; не повторяй её из-за долгого ожидания. Следи за журналом и процессом. Извлечение использует бесплатные HTTP endpoints AssetRipper.
4. **recover**: сохранить hierarchy, meshes, materials, textures и зависимости. Unity `m_PathID` — 64-битный: хранить строкой, не преобразовывать в обычный JS Number. Ссылки `m_FileID` разрешать через dependencies каждой collection, а не через общий индекс bundles.
5. **textures**, **lightmaps**, **collisions**. Unity metalness R / smoothness A преобразуются в glTF metalness B / roughness G. BC6H lightmaps нельзя брать из byte-valued EXR preview AssetRipper: этап `lightmaps` извлекает DDS и вызывает Microsoft DirectXTex для линейного HDR. Поддержаны UnityFS none/LZ4 и BC6H format 24; другой формат требует отдельного декодера.
6. **probe**: импортировать небольшой участок в Blender и экспортировать GLB в staging. Проверить UV, масштаб, ориентацию, материалы, взлёт и коллизии в настоящем World renderer. Только после этого выполнять **assemble**, затем **export**, **optimize** для всей карты.

Пример вызова любого этапа:

```powershell
node tools/import-game-content.js tools/import-profiles/new-map-demo.json --step=inputs --load
node tools/import-game-content.js tools/import-profiles/new-map-demo.json --step=probe
```

Для источника Liftoff ось X отражается при переходе в игру; Blender использует Z вверх. AssetRipper GLB уже отражает X, но не UV, тогда как glTF importer Blender отражает V — импортёр отменяет этот второй переворот. Static batches имеют вершины в координатах сцены; dynamic meshes преобразуются hierarchy matrix. Не применять объектные transforms к static batches повторно.

Если ключевые meshes/textures/transforms не восстановлены, перечислить отсутствующее и остановить подключение карты. Не заполнять пробелы видимыми примитивами. Нативная сцена сохраняется как `content/maps/<id>/map.blend`; delivery copies и decimation не заменяют её. Проверить длинные трубы, округлые детали, UV и маркировку на Low крупным планом.

## Трассы и задания

Для штатных трасс Liftoff использовать **recoverTracks**, **gateConfig**, **tracks**:

```powershell
node tools/import-game-content.js tools/import-profiles/minus-two-demo.json --step=recoverTracks
node tools/import-game-content.js tools/import-profiles/minus-two-demo.json --step=gateConfig
node tools/import-game-content.js tools/import-profiles/minus-two-demo.json --step=tracks
```

`Shared/Tracks/<Scene>TrackNN_0001` и `Shared/Races/<Scene>RaceNN_0001` — LegacyResources TextAssets в `Liftoff_Data/resources.assets`, а не отдельные файлы папки Tracks. Первый этап сверяет ключи каталога, проверяет длину записи и извлекает оригинальный XML. Порядок гонки задаётся графом `uniqueId → nextPassageIDs`, **не порядком XML элементов**. Должны сохраняться круги, связь с Track GUID, spawn и размеры контрольных поверхностей из префабов.

Для префабов с удалённой версией Unity в своей сессии AssetRipper до загрузки задать **Settings → Default Version → 2022.3.62f3** (версия из профиля). При 0.0.0 вместо префабов появляются UnreadableGameObject. Настройка доступна только до загрузки; если нужно, сбросить только собственную сессию. Не менять пользовательскую сессию другой задачи. `gateConfig --loaded` повторяет чтение уже загруженных пакетов без распаковки.

Преобразование адаптирует исходный Start/Finish к существующему countdown: общий портал Finish остаётся один раз за круг. Знак normal ориентирован по импортированному маршруту; исходные directionality и passage IDs сохранены. Видимые ворота использует действующий renderer игры; декоративные объекты самих трасс (конусы, ограждения, рекламные стойки) пока не импортируются. Проверка: `node tools/check-liftoff-tracks.js` — число гонок, порядок, свободные старты и проходимая часть каждого checkpoint. Для tilted/branching графов нельзя молча упрощать данные: конвертер останавливается.

После **export** обязательно выполнить **geometryCheck**, затем **optimize**, **package**, **markers**, **sync**, **check**, **build**. Coverage сравнивает исходный Blender с каждым LOD по лучам пола, потолка и стен; package отклоняет отчёт с потерянными поверхностями. Сравнение геометрии не заменяет осмотр в браузере.

**course** ищет доступные клетки реального collision floor и соединяет точки маршрута. Его текущий поиск работает на одной горизонтальной высоте; для рамп, нескольких этажей и открытого рельефа создать/отредактировать трассу вручную в Blender или JSON. Он проверяет места ворот, но не заменяет полный облёт.

**package** подключает map, основной race, короткий учебный race, tutorial и timed challenge существующими форматами. Он также проверяет наличие всех именованных LOD nodes в GLB и сохраняет `SOURCE.json` / копию профиля. Затем **markers** добавляет трассы в редактируемый `.blend`; **sync**, **check**, **build** обновляют локальную игру.

Для дополнительного задания на уже готовой карте извлечение ресурсов не нужно:

- `content/races/<id>/race.json`: `{id,name,map,laps,spawn:{position,yaw},gates:[{position,yaw,width,height,gateClass,frameThickness,support}]}`. Порядок массива — порядок прохождения; yaw задаёт направление.
- `content/challenges/<id>/challenge.json`: `{id,name,map,track,description,target,reward,hints}`; `target` — секунды. Существующие механики добавляют его в карьеру.
- `content/tutorials/<id>/tutorial.json`: `{id,name,map,track,steps:[{text,objective,target,duration}]}`. Objective: `altitude`, `gate`, `land`, а другие варианты сверять со schema и SoloSession. Номер gate начинается с 0; duration — секунды.

Изменения готовой сцены экспортировать через этот pipeline. Обычный `content:blender --publish` пока **не сохраняет подготовленную структуру spatial LOD импортированной карты**; использовать `--markers` допустимо. Перед повторным **assemble** сохранить ручные Blender-изменения отдельно: этот этап заново строит исходник из staging.

## Проверка и показ

`check` выполняет content validation, свободный старт и подходы к воротам, направление пересечения, физическое зависание/посадку и reset, а также проверяет неизменность Kestrel и flight parameters. После изменений логики выполнить существующие тесты; после контента — build и браузерный просмотр. Отдельно пройти обучение, гонку, timed mission, перезапуск и совместный полёт двух браузеров с результатами. WebSocket smoke проверяет транспорт, а не визуальную приёмку.

Страница осмотра: `http://127.0.0.1:2570/editor/minus-two-review.html?backend=webgl`. Для другой карты добавить `&profile=tools/import-profiles/new-map-demo.json`; для небольшого участка также `&probe`. Обычная локальная игра для Minus Two: `http://127.0.0.1:2590/`. Используется отдельная база `data/minus-two-demo-server`; лимит 20. Процессы нужно оставить работающими для пользователя.

Для проверки конкретной трассы добавить `&track=minus-two-demo-liftoff-01` (01…05) к странице осмотра. В обычной игре выбрать Race/Time trial и трассу по её имени.

Для Low записывать framebuffer 1280×720, backend, triangles, draw calls и mip texture memory. Бюджеты: 300k / 250 / 256 MiB. Осмотреть старт, крупные детали, потолок, обратный ракурс и весь маршрут. FPS/UHD 620 подтверждается только на целевом ноутбуке с отключённым adaptive resolution; цифры render budgets и тест на другом GPU не заменяют это измерение.

Сохранить реальный screenshot/thumbnail. Открыть локальную страницу пользователю, дать ссылку и короткие инструкции. Не объявлять художественную приёмку пройденной без просмотра пользователем.

## Публикация

Сейчас запрошен локальный показ. Если позже пользователь продолжает выпуск, следовать `FREE-HOSTING.md` / `deploy/deploy.sh`: доступ, backup, env, drain, новый release, сохранённые DB/образ, HTTPS/health/game/multiplayer, current и журнал. Локальный build не обновляет Oracle. Бюджет $0, лимит 20 и база игроков сохраняются. Неподтверждённые права на Liftoff записаны в SOURCE; не выдавать их за разрешение на публикацию.
# Native outdoor terrain continuation (18 October 2026)

For a selected outdoor scene, run `--step=terrain` after `recover` and before
`details`, `textures`, `collisions` and Blender assembly. The stage preserves
the original scene metadata, saves native TerrainData, and writes derived
`scene-with-terrain.json` plus `terrain-report.json`. Do not repeat completed
recovery: The Green and Pine Valley are cached; see LEARNING-MAPS-20261018.md.

Height samples use signed-short normalization by 32767, per AssetRipper's
GlbTerrainBuilder. Painted alpha weights and source layer tiling are baked to
patch PBR maps. Authored tree/shrub prefab positions, rotations and scales are
retained. Native grass in InstanceCountMode retains its density map and atlas,
with explicitly adapted static crossed cards, deterministic scatter, tint and
far-distance fading. Unity wind animation is not reproduced. Unsupported holes,
coverage-mode detail density or skinned vegetation must fail explicitly.

References: https://github.com/AssetRipper/AssetRipper/blob/master/Source/AssetRipper.Export.Modules.Models/GlbTerrainBuilder.cs
and https://github.com/Unity-Technologies/UnityCsReference/blob/master/Modules/Terrain/Public/TerrainData.bindings.cs .

Native outdoor materials include optimized Tree Creator leaves/bark and AFS
ferns. Keep the authored alpha cutoff on leaves; the same atlas on bark remains
opaque. Their packed normal/specular/translucency and wind adaptations are
explicit in the material report. Blender cutouts use an explicit comparison
node so both the editable render and delivery preserve the empty atlas area.
Track texture recovery includes Standard Specular's `_SpecGlossMap`; inspect
missing bindings before accepting a material audit.

For a material fix affecting only some courses, Blender's
`import_liftoff_track_models.py -- --tracks=1,2` rebuilds just those course
visuals and merges their entries into the retained track-model report. Optimize
those outputs and run all course material audits afterwards.

Profiles may explicitly enable `trackOptions.adaptSpawnClearance`. After track
collision recovery, this checks the actual Kestrel compound volume plus a
0.18 metre centre probe and raises an obstructed start in 0.01 metre steps,
up to 0.5 metres. X/Z and heading stay authored. The original and delivered
positions are recorded in each affected course's SOURCE and the recovery's
spawn-clearance report. An unresolved obstruction fails; never move gates to
silence the checker. Re-run source-course passage checks after adaptation.
The passage checker now tests Kestrel's complete collision volume through a
legal source aperture point, including approach/departure clearance and tilted
elliptical gates. It keeps every source portal fixed.
The optional `trackOptions.adaptCheckpointRespawn` also verifies each derived
checkpoint reset. An obstructed reset can use the gate's validated `respawn`
pose at a legal point 0.5 metres after the portal; SOURCE records the adaptation.
Ordinary gates retain the existing 1.3 metre reset rule. Source portal positions
and race order remain unchanged.
