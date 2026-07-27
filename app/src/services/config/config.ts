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
    modelsGroupe: ModelsGroupe,
}

export type ModelsConfig = {
    [key: string]: AIModel
}

// Конфигурационные константы и переменные
const MODELS_CONFIG: ModelsConfig = {
    deepseek_r1_ollama: {
        key: "deepseek_r1_ollama",
        key_api: "deepseek-r1:1.5b",
        text: "deepseek r1",
        api_url: "",
        modelsGroupe: ModelsGroupe.OLLAMA,
        superUser: false,
        off: true,
    },
    mistral_latest: {
        key: "mistral_latest",
        key_api: "mistral:latest",
        text: "mistral",
        api_url: "",
        modelsGroupe: ModelsGroupe.OLLAMA,
        off: true,
        superUser: true,
    },
    llama2_7b: {
        key: "llama2_7b",
        text: "Llama2_7b",
        api_url: "http://llamacpp-llama-2-7b-model:12535/completion",
        off: true,
        modelsGroupe: ModelsGroupe.LLAMA_CPP,
    },
    ggml: {
        key: "ggml",
        text: 'Ggml',
        api_url: "http://llamacpp-server:12534/completion",
        off: true,
        modelsGroupe: ModelsGroupe.LLAMA_CPP,
    },
    qwen_ai: {
        key: "qwen_ai",
        text: 'Qwen best local',
        api_url: "http://qwen-ai-research:12536/completion",
        off: false,
        modelsGroupe: ModelsGroupe.LLAMA_CPP,
    },
    deepseek_chat: {
        key: "deepseek-chat",
        text: 'DeepSeek OUT not free',
        api_url: "",
        off: true,
        superUser: true,
        modelsGroupe: ModelsGroupe.OTHER,
    },
    glm_4_5_air: {
        key_api: "z-ai/glm-4.5-air:free",
        key: "glm_4_5_air",
        text: 'GLM-4.5-air OUT',
        api_url: "",
        off: true,
        superUser: true,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    moonshotai_kimi_k2: {
        key_api: "moonshotai/kimi-k2:free",
        key: "moonshotai_kimi_k2",
        text: 'MoonshotAI: Kimi K2 AVP OUT',
        api_url: "",
        superUser: true,
        off: true,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    dolphin_mistral_24b: {
        key_api: "ognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        key: "dolphin_mistral_24b",
        text: 'Dolphin-mistral-24b OUT',
        api_url: "",
        superUser: true,
        off: true,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    deepseek_chat_v3: {
        key_api: "deepseek/deepseek-chat-v3-0324:free",
        key: "deepseek_chat_v3",
        text: 'DeepSeek V3 0324 OUT',
        api_url: "",
        superUser: true,
        off: true,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    deepseek_r1_0528: {
        key_api: "deepseek/deepseek-r1-0528:free",
        key: "deepseek_r1_0528",
        text: 'DeepSeek: R1 0528 OUT',
        api_url: "",
        superUser: true,
        off: true,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    embeddings_ollama: {
        key: "embeddings_ollama",
        key_api: "nomic-embed-text", // all-minilm:l6-v2 - 384 , nomic-embed-text - 768
        text: "nomic-embed-text",
        api_url: "",
        modelsGroupe: ModelsGroupe.OLLAMA,
        superUser: true,
        off: true,
    },
    preparation_ollama: {
        key: "preparation_ollama",
        key_api: "qwen2.5:3b",
        text: "qwen2.5:3b",
        api_url: "",
        modelsGroupe: ModelsGroupe.OLLAMA,
        superUser: true,
        off: true,
    },
    deepseek_v_3_2_timeweb: {
        key: "deepseek_v_3_2_timeweb",
        key_api: "deepseek_v_3_2_timeweb",
        text: "DeepSeek V3.2 new",
        api_url: "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/084d0325-563b-4d4c-a9e2-631216a73f00/v1/chat/completions",
        modelsGroupe: ModelsGroupe.TIMEWEB_CLOUD_AI,
        superUser: true,
    },
};

const MODEL_DEFAULT = MODELS_CONFIG.qwen_ai;

// Асинхронная загрузка конфигурации
export const loadConfig = async () => {
    // Значения по умолчанию
    const DEFAULT_TOKEN_TELEGRAM = await redisInstance.getEnvConfig('DEFAULT_TOKEN_TELEGRAM');
    const DEEPSEEK_API_KEY = await redisInstance.getEnvConfig('DEEPSEEK_API_KEY');
    const OPEN_AI_API_KEY = await redisInstance.getEnvConfig('OPEN_AI_API_KEY');
    const KINOPOISK_API_KEY = await redisInstance.getEnvConfig('KINOPOISK_API_KEY');
    const TIMEWEB_AI_API_KEY = await redisInstance.getEnvConfig('TIMEWEB_AI_API_KEY');

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
        `
    const DEFAULT_START_TOOLS_PROMPT = `
        Ты — помощник, который отвечает только на русском языке. Отвечай кратко и по существу на поставленные вопросы. Не начинай разговор сам, не уходи в рассуждения и не отвлекайся от темы.
        
        Всегда форматируй ответы строго по правилам Telegram MarkdownV2:
        1. Правильная вложенность форматирования
        2. Экранирование специальных символов
        3. Валидные гиперссылки в формате \[текст](URL)
        4. Запрет HTML-тегов
        5. Никогда не используй HTML\\-теги
        6. Перед отправкой проверяй экранирование и парность тегов
        

    У тебя есть специальный инструмент knowledge_search. Он сначала ищет информацию во внутренней базе знаний, 
    а если там нет нужных данных — при необходимости дополняет ответ информацией из интернета.
    Стратегия работы:

    1. Сначала используй knowledge_search, если:
   - вопрос может относиться к продуктам, услугам, документации, тарифам, регламентам, настройкам и работе сервисов компании;
   - вопрос требует актуальной или фактической информации, которую лучше перепроверить по базе знаний или из внешних источников.

    2. Если knowledge_search вернул релевантную информацию:
   - внимательно проанализируй результаты,
   - опирайся на них в ответе,
   - по возможности указывай, какие факты взяты из найденных материалов.
   - форматируй ответы строго по правилам Telegram MarkdownV2 как указано выше

    3. Если knowledge_search не дал полезной информации:
   - честно скажи, что в доступных источниках нет точных данных,
   - можешь дать общий ответ, но явно обозначь, что это обобщённые рекомендации, а не данные из базы знаний или интернета.

    4. Если можешь уверенно ответить из собственных знаний (например, общий теоретический вопрос), knowledge_search можно не вызывать, 
    но при малейших сомнениях лучше всё равно использовать инструмент.

    Отвечай по-русски, структурировано и понятно. Если пользователь просит сослаться на источники или уточнить, 
    откуда взята информация, указывай, что именно пришло из knowledge_search.
`;

    const DEFAULT_START_MESSAGE = 'Привет! Я бот Леша помогаю отвечать на твоий вопросы при помощи LLM и базы знаний. Напиши мне что-нибудь!';

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
    const startToolsPrompt = await redisInstance.getConfig('start_tools_prompt', DEFAULT_START_TOOLS_PROMPT);
    const satrtFrmattedTextPromt = await redisInstance.getConfig('tart_formatted_text_promt', DEFAULT_START_FORMATTED_TEXT_PROMT);


    const ERROR_MODEL_MESSAGE = "Извините, произошла ошибка при обработке запроса.";

    const ADMIN_USERS_TELEGRAM = utils.parseNumbers(await redisInstance.getEnvConfig('ADMIN_USERS_TELEGRAM') || '');
    const SUPER_USERS_TELEGRAM = utils.parseNumbers(await redisInstance.getEnvConfig('SUPER_USERS_TELEGRAM') || '');

    return {
        DEFAULT_TOKEN_TELEGRAM,
        DEEPSEEK_API_KEY,
        OPEN_AI_API_KEY,
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
    };
};

export type LoadConfig = Awaited<ReturnType<typeof loadConfig>>;