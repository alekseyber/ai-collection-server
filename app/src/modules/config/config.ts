import { utils } from '../utils/utils';
import { ModelsConfig } from "../ai-service"


// Конфигурационные константы и переменные

// Значения по умолчанию
const DEFAULT_TOKEN_TELEGRAM = process.env.DEFAULT_TOKEN_TELEGRAM;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;


const DEFAULT_START_PROMPT = "Ты — помощник, который отвечает только на русском языке. Отвечай кратко и по существу на поставленные вопросы. Не начинай разговор сам, не уходи в рассуждения и не отвлекайся от темы." +
    "Если вопрос непонятен или выходит за рамки твоих возможностей, скажи об этом прямо." +
    "Генерировать текст нужно с использованием разметки Telegram MarkdownV2." +
    "При создании разметки необходимо строго соблюдать следующие технические требования:" +
    "1. Все парные символы форматирования (\`*\`, \_\, \~\, \\) должны быть корректно открыты и закрыты, без нарушений порядка и вложенности." +
    "2. Вложенность форматирования должна быть синтаксически корректной и не пересекаться. Например, нельзя открыть один тип форматирования внутри другого и закрыть их в неправильном порядке." +
    "3. Все специальные символы MarkdownV2, не входящие в разметку, должны быть экранированы обратным слешем (\`). К таким символам относятся: \_\, \*\, \[\, \]\, \(\, \)\, \~\, \\, \>\, \#\, \+\, \-\, \=\, \|\, \{\, \}\, \.\, \!\." +
    "4. При вставке гиперссылок использовать синтаксис \[текст](URL)\. Текст ссылки может содержать вложенную корректную разметку MarkdownV2. URL должен быть валидным, не содержать пробелов и незакрытых скобок." +
    "5. Обратные слеши (\`) должны экранироваться корректно, чтобы не нарушать структуру разметки." +
    "6. Не добавлять лишних пробелов или символов, которые могут привести к ошибкам парсинга MarkdownV2." +
    "7. Запрещается использовать HTML-теги или другие форматы разметки; разрешена исключительно MarkdownV2." +
    "8. В случае невозможности корректного форматирования следует вернуть текст без разметки, чтобы избежать ошибок парсинга." +
    "Генерируемый результат должен полностью соответствовать описанным требованиям и быть корректно распознаваем Telegram как MarkdownV2.";



const DEFAULT_START_PROMPT_2 = "Ты — помощник, который отвечает только на русском языке." +
    "Отвечай кратко и по существу на поставленные вопросы. Не начинай разговор сам, не уходи в рассуждения и не отвлекайся от темы. " +
    "Если вопрос непонятен или выходит за рамки твоих возможностей, скажи об этом прямо."
const DEFAULT_START_MESSAGE = 'Привет! Я бот Леша с локальной языковой моделью. Напиши мне что-нибудь!';
const MODELS_CONFIG: ModelsConfig = {
    llama2_7b: {
        key: "llama2_7b",
        text: "Llama2_7b",
        api_url: "http://llamacpp-llama-2-7b-model:12535/completion",
        off: true,
    },
    ggml: {
        key: "ggml",
        text: 'Ggml',
        api_url: "http://llamacpp-server:12534/completion",
        off: false,
    },
    qwen_ai: {
        key: "qwen_ai",
        text: 'Qwen best local',
        api_url: "http://qwen-ai-research:12536/completion",
        off: false,
    },
    deepseek_chat: {
        key: "deepseek-chat",
        text: 'DeepSeek OUT not free',
        api_url: "",
        off: true,
        superUser: true,
    },
    glm_4_5_air: {
        key_api: "z-ai/glm-4.5-air:free",
        key: "glm_4_5_air",
        text: 'GLM-4.5-air OUT',
        api_url: "",
        off: false,
        superUser: true,
    },
    moonshotai_kimi_k2: {
        key_api: "moonshotai/kimi-k2:free",
        key: "moonshotai_kimi_k2",
        text: 'MoonshotAI: Kimi K2 AVP OUT',
        api_url: "",
        superUser: true,
        off: false,
    },
    dolphin_mistral_24b: {
        key_api: "ognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        key: "dolphin_mistral_24b",
        text: 'Dolphin-mistral-24b OUT',
        api_url: "",
        superUser: true,
        off: false,
    },
};

const OPEN_ROUTER_MODELS = [MODELS_CONFIG.glm_4_5_air.key, MODELS_CONFIG.moonshotai_kimi_k2.key, MODELS_CONFIG.dolphin_mistral_24b.key];
const MODEL_DEFAULT = MODELS_CONFIG.ggml;



// Глобальные переменные для хранения текущих значений
let startPrompt = DEFAULT_START_PROMPT;
let startMessage = "Добро пожаловать! Я твой персональный бот Леша.";

const ERROR_MODEL_MESSAGE = "Извините, произошла ошибка при обработке запроса.";



const ADMIN_USERS_TELEGRAM = utils.parseNumbers(process.env.ADMIN_USERS_TELEGRAM);
const SUPER_USERS_TELEGRAM = utils.parseNumbers(process.env.SUPER_USERS_TELEGRAM);

export const config = {
    DEFAULT_TOKEN_TELEGRAM,
    DEEPSEEK_API_KEY,
    OPEN_AI_API_KEY,
    DEFAULT_START_PROMPT,
    DEFAULT_START_PROMPT_2,
    DEFAULT_START_MESSAGE,
    MODELS_CONFIG,
    OPEN_ROUTER_MODELS,
    MODEL_DEFAULT,
    startPrompt,
    startMessage,
    ERROR_MODEL_MESSAGE,
    ADMIN_USERS_TELEGRAM,
    SUPER_USERS_TELEGRAM,
};