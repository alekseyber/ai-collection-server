# AI Collection Server

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

Мульти-провайдерный AI-агент с Telegram-ботом. Поддерживает streaming, JSON mode, ReAct agent loop, RAG (pgvector) и Tool System.

## Архитектура

```
User → Telegram → message-handler.ts
    → AIService
        → ReActAgent.runStream()
            → ToolRegistry (5 tools)
            → Safety layer (isPathAllowed, isSafeCommand)
            → providerFactory.createProvider()
                → provider.askJson()    — ReAct шаги (JSON mode)
                → provider.askStream()  — финальный ответ (streaming)
    → ReAct Loop: askJson → thought|action → tool execute → ... → final → streaming chunks
```

### Режимы работы

| Режим | Провайдеры | Описание |
|-------|-----------|---------|
| **Tool mode** | SiliconFlow, OpenRouter, Ollama | ReActAgent → askJson → extractFirstJson → tool execute → streaming final |
| **Chat mode** | Timeweb (toolsDisabled: true) | askStream напрямую, без ReAct, без тулов |

## Провайдеры

| Провайдер | Модели | Статус | API |
|-----------|--------|--------|-----|
| **SiliconFlow** | DeepSeek V4 Flash/Pro, Qwen 3.5, Qwen VL | 🟢 active | `api.siliconflow.com/v1` |
| **OpenRouter** | GPT-4o, Claude, другие | 🟢 active | `openrouter.ai/api/v1` |
| **Timeweb** | DeepSeek V4 Flash (AI Agent), toolsDisabled | 🟢 active | `agent.timeweb.cloud/api/v1` |
| **Ollama** | Локальные модели | 🔴 off (ждёт GPU) | `ollama:11434/v1` |
| **LlamaCpp** | GGUF-модели | 🔴 off (ждёт GPU) | прямой fetch |

## Tool System

5 системных инструментов для ReActAgent:

| Инструмент | Описание |
|-----------|---------|
| `read_file` | Чтение файла с offset/limit |
| `write_file` | Создание/перезапись файла (только в sandbox: /tmp/, scripts/, tools/, plugins/) |
| `patch` | Find-and-replace (безопаснее write_file) |
| `search_files` | Рекурсивный grep по файлам |
| `terminal` | Shell-команды (exec, безопасные: без rm -rf, sudo, chmod 777) |

**Safety layer:**
- `isPathAllowed` — запись только в sandbox-директории
- `isSafeCommand` — блокировка опасных команд/паттернов
- `PROTECTED_DIRS` — providers/, agents/, config/, index.ts (нельзя менять)
- Safety prompt в REACT_SYSTEM_PROMPT (6 правил, игнор user override)
- `write_file` запрашивает подтверждение если файл существует

**Config:** `toolsDisabled: true` для Timeweb — модель работает без инструментов (простой стриминг).

## Streaming

Ответ финального шага разбивается на 10 чанков для плавного вывода в Telegram.

```typescript
for await (const step of agent.runStream(history, userMessage, modelKey)) {
    if (step.type === 'chunk') {
        fullContent += step.content;
        // редактируем сообщение в Telegram
    }
    if (step.type === 'final') {
        await ctx.reply(step.answer, { parse_mode: 'Markdown' });
    }
}
```

## JSON mode

Все провайдеры реализуют `askJson<T>()` — ответ гарантированно валидный JSON. Используется `extractFirstJson` с подсчётом скобок (без `response_format` на стороне API).

```typescript
const step = await provider.askJson<ReActStep>(messages, userId, modelKey);
// step.type: 'thought' | 'action' | 'final'
```

## ReAct Agent Loop

Цикл: **askJson → thought/action → tool execute → askJson → ... → final → streaming**

- Первый вызов `askJson` определяет: диалог (final) или инструмент (action)
- Если action → execute tool → continue askJson loop
- Если final → разбить на чанки → стриминг
- Лимит итераций — 10 (предохранитель от бесконечного цикла)

## Начало работы

### Переменные окружения (.env)

```
SILICON_FLOW_AI_API_KEY=sk-...
OPEN_AI_API_KEY=sk-...          # OpenRouter
TIMEWEB_AI_API_KEY=...          # Timeweb AI Agent
DEFAULT_TOKEN_TELEGRAM=...      # Telegram Bot Token
KINOPOISK_API_KEY=...           # опционально
```

### Запуск

```bash
docker compose up -d
```

Контейнер `nodejs` слушает Telegram-бота. Изменения в `app/src/` подхватываются автоматически (bind mount + nodemon).

## Структура проекта

```
app/src/
├── services/
│   ├── ai-service/              # AI core
│   │   ├── ai-provider.interface.ts
│   │   ├── ai-service.ts        # AIService entry point
│   │   ├── embedding-service.ts # RAG (pgvector)
│   │   ├── agents/
│   │   │   └── react-agent.ts   # ReAct Agent (askJson, toolsDisabled support)
│   │   ├── tools/               # Tool System
│   │   │   ├── tool.interface.ts
│   │   │   ├── tool-registry.ts
│   │   │   ├── safety.ts        # isPathAllowed, isSafeCommand
│   │   │   ├── read-file.tool.ts
│   │   │   ├── write-file.tool.ts
│   │   │   ├── patch-file.tool.ts
│   │   │   ├── search-files.tool.ts
│   │   │   └── terminal.tool.ts
│   │   └── providers/
│   │       ├── ai-provider.factory.ts
│   │       ├── silicon.provider.ts  (extractFirstJson, AbortController)
│   │       ├── openrouter.provider.ts (extractFirstJson)
│   │       ├── timeweb.provider.ts   (toolsDisabled, extractFirstJson)
│   │       ├── ollama.provider.ts    (extractFirstJson)
│   │       └── llamacpp.provider.ts
│   ├── bot-handlers/            # Telegram bot handlers
│   │   ├── message-handler.ts   # streaming handler
│   │   └── ...
│   ├── config/
│   │   └── config.ts            # PROVIDER_BASE_URLS, модели, toolsDisabled
│   └── ...
├── index.ts
└── tsconfig.json
```

## 🧪 E2E Testing

Система E2E тестирования бота через inject-mode: `docker exec` → инжекция fake update'ов напрямую в handlers.

Тест-кейсы: `app/src/tests/test-cases/` (7 шт).

Подробнее: [app/src/tests/README.md](app/src/tests/README.md)

## Дорожная карта

- ✅ **Phase 1.1** — Streaming, JSON mode, ReAct agent loop
- ✅ **Phase 1.3** — Tool System (read_file, write_file, patch, search_files, terminal)
- 🟡 **Phase 1.2** — RAG-пайплайн (pgvector — уже есть, улучшить)
- ⏳ **Phase 0.5** — Observability (OpenTelemetry + Jaeger)
- ⏳ **Phase 2** — GPU-инференс (vLLM, после RTX 3090)
- ⏳ **Phase 3** — Fine-tuning, AI-продукт