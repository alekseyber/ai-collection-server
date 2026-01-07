import { utils } from '../utils/utils';
import { redisInstance } from '../redis-client';

// Типы для моделей AI
export enum ModelsGroupe {
    OLLAMA = "ollama",
    LLAMA_CPP = "llama_cpp",
    OPEN_ROUTER = "open_router",
    OTHER = "other",
}

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
        off: false,
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
        off: false,
        superUser: true,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    moonshotai_kimi_k2: {
        key_api: "moonshotai/kimi-k2:free",
        key: "moonshotai_kimi_k2",
        text: 'MoonshotAI: Kimi K2 AVP OUT',
        api_url: "",
        superUser: true,
        off: false,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    dolphin_mistral_24b: {
        key_api: "ognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        key: "dolphin_mistral_24b",
        text: 'Dolphin-mistral-24b OUT',
        api_url: "",
        superUser: true,
        off: false,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    deepseek_chat_v3: {
        key_api: "deepseek/deepseek-chat-v3-0324:free",
        key: "deepseek_chat_v3",
        text: 'DeepSeek V3 0324 OUT',
        api_url: "",
        superUser: true,
        off: false,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
    },
    deepseek_r1_0528: {
        key_api: "deepseek/deepseek-r1-0528:free",
        key: "deepseek_r1_0528",
        text: 'DeepSeek: R1 0528 OUT',
        api_url: "",
        superUser: true,
        off: false,
        modelsGroupe: ModelsGroupe.OPEN_ROUTER,
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

    const DEFAULT_START_PROMPT = "Ты — помощник, который отвечает только на русском языке. Отвечай кратко и по существу на поставленные вопросы. Не начинай разговор сам, не уходи в рассуждения и не отвлекайся от темы." +
        "Если вопрос непонятен или выходит за рамки твоих возможностей, скажи об этом прямо." +
        "Генерировать текст нужно с использованием разметки Telegram MarkdownV2, соблюдая технические требования:\n" +
        "1. Корректное закрытие парных символов форматирования (\`*\`, \_\, \~\, \\)\n" +
        "2. Правильная вложенность форматирования\n" +
        "3. Экранирование специальных символов\n" +
        "4. Валидные гиперссылки в формате \[текст](URL)\n" +
        "5. Запрет HTML-тегов\n" +
        "6. Использование только MarkdownV2";
    const DEFAULT_START_MESSAGE = 'Привет! Я бот Леша с разными языковой моделью. Напиши мне что-нибудь!';


    const startPrompt = await redisInstance.getConfig('start_prompt', DEFAULT_START_PROMPT);
    const startMessage = await redisInstance.getConfig('start_message', DEFAULT_START_MESSAGE);


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
        ERROR_MODEL_MESSAGE,
        ADMIN_USERS_TELEGRAM,
        SUPER_USERS_TELEGRAM,
        KINOPOISK_API_KEY,
    };
};

export type LoadConfig = Awaited<ReturnType<typeof loadConfig>>;