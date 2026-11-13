# 🧪 E2E Testing — ai-collection-server

Система E2E тестирования Telegram-бота через inject-mode.

## Как это работает

Telegram **не передаёт сообщения между ботами** (ограничение API).
Решение — инжекция update'ов напрямую в handlers через `docker exec`:

1. **inject-runner.mjs** внутри контейнера:
   - Создаёт Telegraf-инстанс с handlers бота
   - Инжектит fake update от имени пользователя (ID из `INJECT_USER_ID` или первого аргумента)
   - `bot.handleUpdate()` — бот обрабатывает как реальное сообщение

2. **test-runner.py** (запускается на Hermes, не в проекте):
   - Для каждого шага: `docker exec` → inject-runner.mjs
   - Проверяет exit code (0=PASS) и Docker логи на ошибки
   - PASS / FAIL + отчёт

## Запуск

Запускается через Hermes — напиши в чат:

- `запусти тесты` — все 7 кейсов
- `запусти тесты 01 03` — по номеру
- `запусти тесты /start` — один шаг
- `добавь тест-кейс "..."` — новый YAML

## Тест-кейсы

```
test-cases/
├── 01-basic-commands.yaml    # /start, /clear, /getmodel
├── 02-model-switch.yaml      # /setmodel, /getmodel
├── 03-ai-dialog.yaml         # обычный диалог с AI
├── 04-model-menu.yaml        # /modelmenu
├── 05-agent-tools.yaml       # инструменты ReAct
├── 06-embeddings.yaml        # /on_embeddings
└── 07-full-cycle.yaml        # полный цикл
```

### Как добавить

Создай YAML в `test-cases/`:

```yaml
name: "Название"
steps:
  - action: send_message
    text: "/команда"
    expect:
      no_errors: true
    critical: true

  - action: send_message
    text: "текст"
    expect:
      no_errors: true
      log_contains: "строка"
```

Поля `expect`:
- `no_errors: true` — в логах нет Traceback/TypeError
- `log_contains: "строка"` — ожидаемая строка в логах
- `critical: true` — при падении кейс прерывается

## Структура директории

```
app/src/tests/
├── README.md
├── config.example.yaml       # пример конфига (без секретов)
├── .gitignore
└── test-cases/               # YAML тест-кейсы
```

Сам раннер (`test-runner.py`, `inject-runner.mjs`) живёт на Hermes в `/opt/data/tests/e2e/`.
