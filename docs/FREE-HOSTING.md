# Бесплатное размещение

Цель веб-беты — 100 игроков в комнатах по 2–8. Игра уже опубликована на [parvoz-drone-sim.duckdns.org](https://parvoz-drone-sim.duckdns.org/) с допуском 20; облачное восстановление базы проверено. Вместимость 100 и UHD 620 пока не подтверждены. Текущее состояние: [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md). Полная приёмка: [WEB-BETA.md](WEB-BETA.md).

## Бесплатная VM

Oracle Console → Compute → Instances → Create instance. Используйте **home region** аккаунта (пользователь выбрал Riyadh), Ubuntu 24.04 ARM, `VM.Standard.A1.Flex`, **2 OCPU, 12 ГБ RAM**, boot volume **50 ГБ**. Создайте VCN/public subnet и включите public IPv4. Сгенерируйте SSH key pair и сохраните private key локально; не отправляйте его в чат. Дождитесь Running.

На 5 октября 2026 бесплатная A1-квота соответствует 2 OCPU/12 ГБ; суммарные диски — 200 ГБ, исходящий трафик — 10 ТБ/месяц. Бесплатная VM должна находиться в home region. При Out of host capacity попробуйте другой availability domain этого региона либо повторите позднее. Не переходите на платную форму/Pay As You Go. Свободная ёмкость не гарантируется; простаивающую VM могут изъять. Проверяйте [официальные условия](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) и [шаги создания](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm).

До регистрации `npm run region:latency` сравнивает Дубай/Франкфурт из целевого региона. Это HTTPS-время, не игровой ping. После регистрации используйте выбранный home region.

Разрешите TCP 80/443 в Oracle security list/NSG и Ubuntu firewall для всех, SSH 22 только со своего IP. Порт 2567 остаётся внутренним. Подключение: `ssh -i /path/to/private.key ubuntu@PUBLIC_IP`. Зарегистрируйте бесплатный поддомен [DuckDNS](https://www.duckdns.org/), задайте IP VM. Секретный токен в исходники не добавляйте.

## Публикация

Установите [Docker Engine/Compose для Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Резервным копиям нужны Node.js 24 на хосте и [OCI CLI](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm). Передайте исходники в новый каталог `/opt/liftoff/releases/RELEASE/`, исключив node_modules, dist, data, backups и секретные env-файлы. Сохраните исходный content и public. Пользователь публикации должен владеть каталогом и иметь доступ Docker.

```bash
cp deploy/production.env.example deploy/production.env
# Задайте настоящий GAME_DOMAIN; MAX_MULTIPLAYER_PLAYERS оставьте 20.
chmod 600 deploy/production.env
bash deploy/deploy.sh
curl -f https://YOUR_NAME.duckdns.org/api/health
sudo ln -sfn "$PWD" /opt/liftoff/current
```

Caddy выдаёт HTTPS, обслуживает хешированные карты с кешированием и Range; editor и internal API закрыты снаружи. Компьютер разработчика после публикации не нужен. Новые карты публикуются новым выпуском каталога.

Обновление: новый каталог выпуска, перенос приватных env-файлов, `deploy.sh`. Скрипт сохраняет прежний образ отдельным rollback-тегом до замены общего тега и проверяет его доступность перед закрытием допуска. Сборка идёт при работающей старой версии; затем закрывается допуск новых заездов и ожидается завершение текущих до 12 минут. При незавершённых заездах обновление отменяется. При ошибке активации скрипт пытается восстановить предыдущий образ и ассеты. После публичных игровых проверок и восстановления свежей облачной копии переключите current. Не меняйте ассеты работающего каталога; сохраняйте прежний каталог, образ и его тег.

```bash
mapfile -t previous < deploy/previous-release.txt
bash deploy/rollback.sh "${previous[0]}" "${previous[1]}"
sudo ln -sfn "${previous[0]}" /opt/liftoff/current
```

Постоянный том liftoff_game-data сохраняет базу. Не удаляйте его и не используйте production `down -v`. Совместимость будущих миграций с откатом требует проверки.

При повторном использовании проверенного образа `deploy/build-incremental.sh`
оставляет BuildKit вариантом по умолчанию. На тесной VM можно явно выбрать
`DEPLOY_INCREMENTAL_BUILDER=commit`: после тех же проверок зависимостей,
хешей, ресурсов и свободного места скрипт копирует только проверенный контекст
в новый **не запущенный** контейнер и сохраняет один дополнительный слой.
Сеть отключена, `/data` заменён временным tmpfs, production-том и env не
подключаются. Перед назначением тега проверяются сохранность исходных слоёв,
команды запуска, пользователя, окружения, healthcheck и остальных параметров.
Это использует штатные [docker cp](https://docs.docker.com/reference/cli/docker/container/cp/)
и [docker commit](https://docs.docker.com/reference/cli/docker/container/commit/).
Новый образ всё равно требует изолированной проверки с временной базой;
этот вариант не разрешает обход проверки пакетов или удаления rollback-образов.

Для изменения только dev-зависимостей после свежего VM `npm ci` и сборки есть
явный `DEPLOY_INCREMENTAL_PRODUCTION_LOCK=1`: исключаются только записи
`dev:true`, остальные записи lockfile и runtime-зависимости остаются точными.
Для обновления компилятора без изменения канонических ресурсов применяйте
`--read-only-content-source --verified-source-inventory=FILE` при подготовке
delta: локальные и удалённые исходники должны совпасть с inventory сохранённого
выпуска. Новая VM-сборка обязана воспроизвести каталог и SHA всех файлов.
`DEPLOY_LINK_PATCH_ASSETS=1` позволяет staging ссылаться на новые неизменяемые
файлы из проверенного frozen patch; не перезаписывайте эти входящие ассеты.

Проверьте опубликованный адрес с другого компьютера: `npm run check:public -- --url=https://YOUR_NAME.duckdns.org`. Настройте внешний монитор `/api/health` и уведомления при отказе. Он пока не настроен автоматически; локальная проверка не обнаружит остановку самой VM.

## Перенос аккаунтов

До появления новых игроков сделайте согласованную копию и проверьте восстановление на Node 24:

```powershell
node tools/backup-db.js C:/Temp/liftoff-migration.sqlite
node tools/verify-backup.js C:/Temp/liftoff-migration.sqlite
```

Передайте файл по SSH. На VM: `bash deploy/import-db.sh /absolute/path/liftoff-migration.sqlite`. Импорт заменяет базу нового сервера, сохраняет прежнюю в томе и проверяет целостность. После импорта проверьте старый аккаунт, ID, карьеру, XP, рекорды и открытия с другого компьютера. Копирование открытого SQLite без online backup может потерять WAL-данные.

## Ежедневные копии

Создайте отдельный приватный Standard bucket с отключённым versioning. Настройте Node 24 и OCI CLI под системным пользователем liftoff с домашним каталогом, владением папками выпуска и доступом к группе docker. Например: `sudo useradd --create-home --shell /usr/sbin/nologin liftoff`, затем `sudo usermod -aG docker liftoff`. На нашей VM используется instance principal: dynamic group совпадает только с ID drone-liftoff, а [политика](../deploy/oracle-backup-policy.txt) ограничивает доступ bucket liftoff-backups. В backup.env задаются `OCI_CLI_AUTH=instance_principal` и `OCI_CLI_REGION=me-riyadh-1`; пользовательский API-ключ на сервер не копируется. [Документация Oracle](https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/callingservicesfrominstances.htm).

Скопируйте backup.env.example в deploy/backup.env, заполните namespace и bucket, права 600. Бюджет — 9 ГБ: ниже 10 ГБ Standard allowance во время Free Trial. Квота общая для аккаунта, уменьшите бюджет при других buckets. В Always Free only после trial Oracle указывает 20 ГБ суммарно; предел скрипта не повышается автоматически.

```bash
sudo -u liftoff bash /opt/liftoff/current/deploy/backup.sh
sudo cp deploy/liftoff-backup.service deploy/liftoff-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now liftoff-backup.timer
systemctl list-timers liftoff-backup.timer
journalctl -u liftoff-backup.service
```

Скрипт делает согласованную копию, проверяет восстановление временной базы, загружает с checksum и после успешной загрузки оставляет семь последних дат. Перед загрузкой проверяется бюджет с учётом новой копии. При ошибке он сохраняет локальный файл и завершает работу с ненулевым кодом. Таймер ежедневный около 03:00 UTC. Уведомление об ошибках настройте отдельно.

До запуска и периодически скачивайте копию из Object Storage, выполняйте verify-backup.js, запускайте отдельный сервер с восстановленной базой и проверяйте аккаунт/прогресс. Локальные тесты не подтверждают настоящую облачную выгрузку.

Калибровка, графика и вручную сохранённые реплеи остаются в браузере. Для переноса между адресами используйте Export/Import Local Data; токен входа не экспортируется.
