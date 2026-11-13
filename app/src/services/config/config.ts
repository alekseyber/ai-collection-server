import { utils } from '../utils/utils';
import { redisInstance } from '../redis-client';
import { ModelsGroupe } from './models-groupe.enum';

export type AIModel = {
  key: string;
  key_api?: string;
  text: string;
  api_url: string;
  off?: boolean;
  superUser?: boolean;
  modelsGroupe: ModelsGroupe;
  toolsDisabled?: boolean;
  /** Имя поля LoadConfig с API-ключом провайдера (ключ лежит в переменных окружения). */
  api_key_env?: string;
  /** Своя системная инструкция модели (для локальных LoRA — формулировка обучения). */
  system_prompt?: string;
  /** Нативный флаг Ollama: рассуждение модели. false — быстрый ответ без thinking. */
  think?: boolean;
};

export type ModelsConfig = {
  [key: string]: AIModel;
};

// Конфигурационные константы и переменные
const MODELS_CONFIG: ModelsConfig = {
  deepseek_r1_ollama: {
    key: 'deepseek_r1_ollama',
    key_api: 'deepseek-r1:1.5b',
    text: 'deepseek r1 1.5b local',
    api_url: 'http://ollama:11434/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OLLAMA,
    superUser: false,
    // 05.11.2026: 1.5b-дистилл ломает русский (выдаёт китайские иероглифы вперемешку,
    // на части запросов весь бюджет уходит в reasoning и content приходит пустой).
    // Модель оставлена на диске, но из выбора убрана до замены на рабочую.
    off: true,
  },
  mistral_latest: {
    key: 'mistral_latest',
    key_api: 'mistral:latest',
    text: 'mistral local',
    api_url: 'http://ollama:11434/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OLLAMA,
    // 05.11.2026: модель удалена с диска по итогам замера (llama 7.2B, ~7 ток/с,
    // русский слабее gemma3:4b) — запись выключена, из меню выбора убрана.
    off: true,
    toolsDisabled: true,
    superUser: true,
  },
  qwen3_8b_ollama: {
    key: 'qwen3_8b_ollama',
    key_api: 'qwen3:8b',
    text: 'qwen3 8b local',
    api_url: 'http://ollama:11434/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OLLAMA,
    // Инференс только на CPU (8 потоков): ReAct-цикл с JSON-тулами на 8B слишком
    // медленный и хрупкий — сначала проверяем простым стримингом.
    toolsDisabled: true,
    superUser: true,
    // 05.11.2026: в меню бота отключено — 7 ток/с на CPU и выдуманные результаты
    // в агентном режиме. Модель остаётся на диске для экспериментов.
    off: true,
  },
  gemma3_4b_ollama: {
    key: 'gemma3_4b_ollama',
    key_api: 'gemma3:4b',
    text: 'gemma3 4b local',
    api_url: 'http://ollama:11434/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OLLAMA,
    off: true,
    toolsDisabled: true,
    superUser: true,
    // 05.11.2026: в меню бота отключено вместе с qwen3:8b — локальные модели
    // оставлены на диске как исследовательская площадка, не как рабочий инструмент.
  },
  llama2_7b: {
    key: 'llama2_7b',
    text: 'Llama2_7b',
    api_url: 'http://llamacpp-llama-2-7b-model:12535/completion',
    off: true,
    modelsGroupe: ModelsGroupe.LLAMA_CPP,
  },
  ggml: {
    key: 'ggml',
    text: 'Ggml',
    api_url: 'http://llamacpp-server:12534/completion',
    off: true,
    modelsGroupe: ModelsGroupe.LLAMA_CPP,
  },
  qwen_ai: {
    key: 'qwen_ai',
    text: 'Qwen best local',
    api_url: 'http://qwen-ai-research:12536/completion',
    off: true,
    modelsGroupe: ModelsGroupe.LLAMA_CPP,
  },
  // 13.11.2026: LoRA-модель стиля Алексея (R1, обучена на его парах).
  // Стенд llama-style живёт на ml:8081 и поднимается по требованию:
  // scripts/llamacpp-idle.sh start style. Тулы не нужны — модель только переписывает текст.
  style_v2: {
    key: 'style_v2',
    key_api: 'style-v2',
    text: 'стиль (моя манера) v2',
    // Группа OPENAI_COMPAT: провайдер шлёт messages на /v1/chat/completions по своему
    // api_url. LLAMA_CPP шлёт legacy {prompt, n_predict} и всегда добавляет JSON-инструкцию,
    // OLLAMA игнорирует api_url и ходит в /api/chat по адресу из PROVIDER_BASE_URLS.
    // Адрес стенда живёт в .env.nodejs (STYLE_MODEL_URL), а не в коде: репозиторий публичный,
    // внутренние адреса сети в него не попадают. Локальный дефолт — для запуска на самой машине.
    api_url: process.env.STYLE_MODEL_URL || 'http://127.0.0.1:8081/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OPENAI_COMPAT,
    // Только для суперюзеров: модель обучена на личных текстах, в чужих диалогах
    // её быть не должно (getModelList отдаёт её лишь тем, кто в SUPER_USERS_TELEGRAM).
    superUser: true,
    // Из меню выбора убрана (13.11.2026). Она стилизатор, а не чат: на вопрос
    // «что такое рефакторинг?» с инструкцией переписывания возвращает сам вопрос.
    // Работает как движок пост-обработки в режиме /style — постпроцессор читает
    // конфиг напрямую, флаг off его не отключает.
    off: true,
    // Своя системная инструкция: LoRA обучена именно на этой формулировке
    // (см. scripts/train_qlora.py, SYSTEM), общий стартовый промпт бота сбивает стиль.
    system_prompt: 'Перепиши текст в моей манере. Сохрани факты, числа и имена. Верни только текст.',
    toolsDisabled: true,
  },
  deepseek_chat: {
    key: 'deepseek-chat',
    text: 'DeepSeek OUT not free',
    api_url: 'https://openrouter.ai/api/v1/chat/completions',
    off: true,
    superUser: true,
    modelsGroupe: ModelsGroupe.OTHER,
  },
  glm_4_5_air: {
    key_api: 'z-ai/glm-4.5-air:free',
    key: 'glm_4_5_air',
    text: 'GLM-4.5-air OUT',
    api_url: 'https://openrouter.ai/api/v1/chat/completions',
    off: true,
    superUser: true,
    modelsGroupe: ModelsGroupe.OPEN_ROUTER,
  },
  moonshotai_kimi_k2: {
    key_api: 'moonshotai/kimi-k2:free',
    key: 'moonshotai_kimi_k2',
    text: 'MoonshotAI: Kimi K2 AVP OUT',
    api_url: 'https://openrouter.ai/api/v1/chat/completions',
    superUser: true,
    off: true,
    modelsGroupe: ModelsGroupe.OPEN_ROUTER,
  },
  dolphin_mistral_24b: {
    key_api: 'ognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    key: 'dolphin_mistral_24b',
    text: 'Dolphin-mistral-24b OUT',
    api_url: 'https://openrouter.ai/api/v1/chat/completions',
    superUser: true,
    off: true,
    modelsGroupe: ModelsGroupe.OPEN_ROUTER,
  },
  deepseek_chat_v3: {
    key_api: 'deepseek/deepseek-chat-v3-0324:free',
    key: 'deepseek_chat_v3',
    text: 'DeepSeek V3 0324 OUT',
    api_url: 'https://openrouter.ai/api/v1/chat/completions',
    superUser: true,
    off: true,
    modelsGroupe: ModelsGroupe.OPEN_ROUTER,
  },
  deepseek_r1_0528: {
    key_api: 'deepseek/deepseek-r1-0528:free',
    key: 'deepseek_r1_0528',
    text: 'DeepSeek: R1 0528 OUT',
    api_url: 'https://openrouter.ai/api/v1/chat/completions',
    superUser: true,
    off: true,
    modelsGroupe: ModelsGroupe.OPEN_ROUTER,
  },
  embeddings_ollama: {
    key: 'embeddings_ollama',
    key_api: 'nomic-embed-text', // all-minilm:l6-v2 - 384 , nomic-embed-text - 768
    text: 'nomic-embed-text',
    api_url: 'http://ollama:11434/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OLLAMA,
    superUser: true,
    off: true,
  },
  silicone_embeddings: {
    key: 'embeddings_out_silicon',
    key_api: 'Qwen/Qwen3-Embedding-0.6B',
    text: 'qwen-embed-text',
    api_url: 'https://api.siliconflow.com/v1/',
    modelsGroupe: ModelsGroupe.SILICON_CLOUD_AI,
    superUser: true,
    off: true,
  },
  deepseek_flash_api: {
    key: 'deepseek_flash_api',
    key_api: 'deepseek-flash',
    text: 'DeepSeek Flash (API)',
    api_url: 'https://api.deepseek.com/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OPENAI_COMPAT,
    // ключ берётся из DEEPSEEK_API_KEY (переменные окружения → кеш в redis)
    api_key_env: 'DEEPSEEK_API_KEY',
    superUser: true,
    // Режим переключается динамически (react-agent): при включённом стиле запрос
    // идёт прямым стримингом, потому что ReAct требует «только JSON» и на этой
    // модели срывается; при выключенном стиле — обычный агентный режим с инструментами.
    off: false,
  },
  silicon_deepseek_v_4_flash: {
    key: 'silicon_deepseek_v_4_flash',
    key_api: 'deepseek-ai/DeepSeek-V4-Flash',
    text: 'DeepSeek V4-Flash silicon',
    api_url: 'https://api.siliconflow.com/v1/chat/completions',
    modelsGroupe: ModelsGroupe.SILICON_CLOUD_AI,
    superUser: true,
    // 13.11.2026: основной провайдер — DeepSeek напрямую (deepseek_flash_api).
    // Silicon остаётся как запасной вариант, из меню убран.
    off: true,
  },
  preparation_ollama: {
    key: 'preparation_ollama',
    key_api: 'qwen2.5:3b',
    text: 'qwen2.5:3b',
    api_url: 'http://ollama:11434/v1/chat/completions',
    modelsGroupe: ModelsGroupe.OLLAMA,
    superUser: true,
    off: true,
  },
  deepseek_v_4_flash_timeweb: {
    key: 'deepseek_v_4_flash_timeweb',
    key_api: 'deepseek_v_4_flash_timeweb',
    text: 'DeepSeek V4-Flash timeweb',
    api_url:
      'https://agent.timeweb.cloud/api/v1/cloud-ai/agents/084d0325-563b-4d4c-a9e2-631216a73f00/v1/chat/completions',
    modelsGroupe: ModelsGroupe.TIMEWEB_CLOUD_AI,
    toolsDisabled: true,
    superUser: true,
    // 27.10.2026: агент Timeweb Cloud AI отвечает 403 agent_suspended —
    // модель недоступна, выключена из списка выбора (ключ и провайдер оставлены)
    off: true,
  },
};

const MODEL_DEFAULT = MODELS_CONFIG.deepseek_flash_api;

// Базовые URL провайдеров (один источник правды)
export const PROVIDER_BASE_URLS: Record<string, string> = {
  silicon: 'https://api.siliconflow.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  timeweb: 'https://agent.timeweb.cloud/api/v1/cloud-ai/agents/084d0325-563b-4d4c-a9e2-631216a73f00/v1',
  ollama: 'http://ollama:11434/v1',
};

// Асинхронная загрузка конфигурации
export const loadConfig = async () => {
  // Значения по умолчанию
  const DEFAULT_TOKEN_TELEGRAM = await redisInstance.getEnvConfig('DEFAULT_TOKEN_TELEGRAM');
  const DEEPSEEK_API_KEY = await redisInstance.getEnvConfig('DEEPSEEK_API_KEY');
  const OPEN_ROUTER_API_KEY = await redisInstance.getEnvConfig('OPEN_ROUTER_API_KEY');
  const KINOPOISK_API_KEY = await redisInstance.getEnvConfig('KINOPOISK_API_KEY');
  const TIMEWEB_AI_API_KEY = await redisInstance.getEnvConfig('TIMEWEB_AI_API_KEY');
  const SILICON_FLOW_AI_API_KEY = await redisInstance.getEnvConfig('SILICON_FLOW_AI_API_KEY');

  const DEFAULT_START_PROMPT = `
    Ты — помощник, который отвечает только на русском языке. 
    Отвечай кратко и по существу на поставленные вопросы. Не начинай разговор сам, не уходи в рассуждения и не отвлекайся от темы.
        Если вопрос непонятен или выходит за рамки твоих возможностей, скажи об этом прямо.
        Всегда форматируй ответы строго по правилам Telegram MarkdownV2:
        1. Правильная вложенность форматирования
        2. Экранирование специальных символов
        3. Валидные гиперссылки в формате \[текст](URL)
        4. Запрет HTML-тегов
        5. Никогда не используй HTML\\-теги
        6. Перед отправкой проверяй экранирование и парность тегов
        7. если правила форматирования Telegram MarkdownV2 не будут применены - user не сможет прочитать твой ответ
        `;
  const DEFAULT_START_TOOLS_PROMPT = `
Ты — JSON-агент. Отвечай ТОЛЬКО в JSON формате, без пояснений и лишнего текста.

Схема ответа:
- Если нужно подумать: {"type": "thought", "content": "твои рассуждения"}
- Если нужно вызвать инструмент: {"type": "action", "tool": "имя_инструмента", "args": {...}}
- Если готов ответить: {"type": "final", "answer": "твой ответ пользователю"}

Правила:
1. Всегда оборачивай ответ в JSON по схеме выше
2. НИКАКОГО текста вне JSON
3. Экранируй кавычки внутри JSON
4. Для Markdown внутри answer используй стандартный Telegram MarkdownV2`;

  const DEFAULT_START_MESSAGE =
    'Привет! Я бот Леша помогаю отвечать на твоий вопросы при помощи LLM и базы знаний. Напиши мне что-нибудь!';

  const DEFAULT_START_FORMATTED_TEXT_PROMT = `
    Ты фильтр перед Telegram-ботом. Твоя задача:
- Получить текст ответа ассистента.
- Вернуть тот же смысл, но отформатированный в Telegram MarkdownV2.
- Обязательно экранируй все специальные символы MarkdownV2, чтобы сообщение НЕ вызывало ошибок Telegram.
- Не добавляй комментариев, пояснений или других фраз, кроме самого ответа.
- Не используй HTML.

Пример:
Вход:
Hello _World_!

Выход (MarkdownV2):
Hello \_World\_!

Теперь текст:
`;

  const startPrompt = await redisInstance.getConfig('start_prompt', DEFAULT_START_PROMPT);
  const startMessage = await redisInstance.getConfig('start_message', DEFAULT_START_MESSAGE);
  const startToolsPrompt = await redisInstance.getConfig(
    'start_tools_prompt',
    DEFAULT_START_TOOLS_PROMPT,
  );
  const satrtFrmattedTextPromt = await redisInstance.getConfig(
    'tart_formatted_text_promt',
    DEFAULT_START_FORMATTED_TEXT_PROMT,
  );

  const ERROR_MODEL_MESSAGE = 'Извините, произошла ошибка при обработке запроса.';

  const ADMIN_USERS_TELEGRAM = utils.parseNumbers(
    (await redisInstance.getEnvConfig('ADMIN_USERS_TELEGRAM')) || '',
  );
  const SUPER_USERS_TELEGRAM = utils.parseNumbers(
    (await redisInstance.getEnvConfig('SUPER_USERS_TELEGRAM')) || '',
  );

  return {
    PROVIDER_BASE_URLS,
    DEFAULT_TOKEN_TELEGRAM,
    DEEPSEEK_API_KEY,
    OPEN_ROUTER_API_KEY,
    DEFAULT_START_PROMPT,
    DEFAULT_START_MESSAGE,
    MODELS_CONFIG,
    MODEL_DEFAULT,
    startPrompt,
    startMessage,
    startToolsPrompt,
    satrtFrmattedTextPromt,
    ERROR_MODEL_MESSAGE,
    ADMIN_USERS_TELEGRAM,
    SUPER_USERS_TELEGRAM,
    KINOPOISK_API_KEY,
    TIMEWEB_AI_API_KEY,
    SILICON_FLOW_AI_API_KEY,
  };
};

export type LoadConfig = Awaited<ReturnType<typeof loadConfig>>;
