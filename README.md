# AI Collection Server

Мульти-провайдерный AI-агент с Telegram-ботом. Поддерживает streaming, JSON mode, ReAct agent loop и RAG (pgvector).

## Архитектура

```
User → Telegram → message-handler.ts
    → AIService
        → ReActAgent.runStream()
            → providerFactory.createProvider()
                → provider.askStream()   — стриминг токенов
                → provider.askJson()    — JSON mode (structured output)
    → ReAct Loop: thought → action (tool call) → ... → final → ответ в Telegram
```

## Провайдеры

| Провайдер | Модели | Статус | API |
|-----------|--------|--------|-----|
| **SiliconFlow** | DeepSeek V4 Flash/Pro, Qwen 3.5, Qwen VL | 🟢 active | `api.siliconflow.com/v1` |
| **OpenRouter** | GPT-4o, Claude, другие | 🟢 active | `openrouter.ai/api/v1` |
| **Timeweb** | DeepSeek V4 Flash (AI Agent) | 🟢 active | `agent.timeweb.cloud/api/v1` |
| **Ollama** | Локальные модели | 🔴 off (ждёт GPU) | `ollama:11434/v1` |
| **LlamaCpp** | GGUF-модели | 🔴 off (ждёт GPU) | прямой fetch |

## Streaming

Все провайдеры поддерживают `askStream()` — ответ передаётся чанками. В Telegram: первое сообщение → `editMessageText` с обновлением каждые N чанков.

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

Все провайдеры реализуют `askJson<T>()` — ответ гарантированно валидный JSON по схеме.

```typescript
const step = await provider.askJson<ReActStep>(messages, userId, modelKey);
// step.type: 'thought' | 'action' | 'final'
```

## ReAct Agent Loop

Цикл: **thought → action (tool execute) → observation → thought → ... → final**

- `knowledge_search` — RAG-поиск по базе знаний (pgvector)
- Tool registry расширяемый — добавление новых инструментов одной строкой
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
│   │   │   └── react-agent.ts   # ReAct Agent (runStream, askJson)
│   │   └── providers/
│   │       ├── ai-provider.factory.ts
│   │       ├── silicon.provider.ts
│   │       ├── openrouter.provider.ts
│   │       ├── timeweb.provider.ts
│   │       ├── ollama.provider.ts
│   │       └── llamacpp.provider.ts
│   ├── bot-handlers/            # Telegram bot handlers
│   │   ├── message-handler.ts   # streaming handler
│   │   └── ...
│   ├── config/
│   │   └── config.ts            # PROVIDER_BASE_URLS, модели
│   └── ...
├── index.ts
└── tsconfig.json
```

## Дорожная карта

- ✅ **Phase 1.1** — Streaming, JSON mode, ReAct agent loop
- 🟡 **Phase 1.2** — RAG-пайплайн (pgvector — уже есть, улучшить)
- 🔄 **Phase 1.3** — Tool registry (web_search, calculator, file_ops)
- ⏳ **Phase 2** — GPU-инференс (vLLM, после RTX 3090)
- ⏳ **Phase 3** — Fine-tuning, AI-продукт