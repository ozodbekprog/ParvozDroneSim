# Сценарий для браузерной приёмки

Выполняет агент через поддерживаемый Chrome-инструмент `cua_repl`. Не использовать
существующий пользовательский игровой адрес: нужен `baseUrl` из checkpoint.

1. Проверить инвентарь Chrome. Если он закрыт — запустить существующий Chrome
   штатным средством. Создать отдельную вкладку с именем задачи. Открыть baseUrl.
   При первом посещении выбрать русский, дождаться готовности и нажать «Играть».
   Сохранить меню как `evidence/chrome-control.png`.
2. Настройки → Графика → Диагностика производительности. Вне полёта кнопки
   записи и скачивания неактивны, есть инструкция начать полёт. Нет фиктивного
   отчёта. Сохранить `evidence/diagnostics-outside-flight.png`.
3. Закрыть → главное меню → Лётная школа. Запомнить выбранный урок и число 12.
   Открыть справочник. Клавиша вправо на «Детали и шкалы» выбирает «Rates и стики»
   и показывает соответствующий текст. Сохранить `evidence/setup-guide-navigation.png`.
4. Закрыть справочник. Та же Лётная школа, тот же выбранный урок, 12 уроков;
   урок не запущен. Сохранить `evidence/guide-return-preserves-screen.png`.

Каждый переход проверять свежим состоянием интерфейса, индексы не переносить
между изменившимися экранами. Сохранить наблюдения и фактическое время проверки.
При провале записать `failed`, при недоступности браузера — `not_run`.

Формат `browser-proof.json` внутри каталога запуска:

```json
{
  "runId": "из checkpoint.json",
  "sourceDigest": "из checkpoint.json",
  "accountKey": "из checkpoint.json, после свежего чтения квоты",
  "observedAt": "фактическое ISO-время проверки",
  "baseUrl": "из checkpoint.json",
  "browser": "Chrome",
  "verifiedBy": "cua_repl",
  "checks": [
    {"name":"chrome-control","status":"passed","evidence":"evidence/chrome-control.png"},
    {"name":"diagnostics-outside-flight","status":"passed","evidence":"evidence/diagnostics-outside-flight.png"},
    {"name":"setup-guide-navigation","status":"passed","evidence":"evidence/setup-guide-navigation.png"},
    {"name":"guide-return-preserves-screen","status":"passed","evidence":"evidence/guide-return-preserves-screen.png"}
  ]
}
```

В примере показаны успешные значения. Создавать их только по фактической проверке.
Для каждого пункта можно добавить `detail` с конкретным наблюдением. `accept`
отклонит другой аккаунт, снимок, сервер, устаревшее время и неполный список.
Результаты браузера после смены аккаунта проверяются заново; снимки не переносить
в новый запуск ради получения зелёного статуса.
