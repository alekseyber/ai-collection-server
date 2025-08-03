import OpenAI from 'openai';
import { config } from './config/config';
import apiClient from './utils/api';

// Типы для моделей AI
export interface AIModel {
  key: string;
  key_api?: string;
  text: string;
  api_url: string;
  off: boolean;
  superUser?: boolean;
}

export interface ModelsConfig {
  [key: string]: AIModel;
}

export type RoleAiMessage = "function" | "developer" | "system" | "user" | "assistant" | "tool";
// Типы для сообщений и истории
export interface Message {
  role: RoleAiMessage;
  content: string;
  name?: string;
}

export interface FormattedText {
  hasMarkdownV2: boolean;
  formattedText: string;
}

// Типы для ответов API
export interface OpenAIResponse {
  content: string;
  [key: string]: any;
}

export interface OllamaResponse {
  response: string;
  [key: string]: any;
}

export interface LlamacppResponse {
  content: string;
  [key: string]: any;
}


//https://openrouter.ai/z-ai/glm-4.5-air:free/api
const clientOpenRuter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.OPEN_AI_API_KEY,
});

function formatMessagesFromOpenAi(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {

    const result = messages.map((message) => {
        return {
            role: message.role,
            content: message.content,
            name: message.name,
        }
    }) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    return result
}

/**
 * Отправляет запрос к OpenAI
 */
async function askOpenAi(messages: Message[], userId: number, modelKey = config.MODELS_CONFIG.glm_4_5_air.key): Promise<string> {
    try {
        const model = config.MODELS_CONFIG[modelKey].key_api || config.MODELS_CONFIG.glm_4_5_air.key_api;
        const completion = await clientOpenRuter.chat.completions.create({
            model,
            messages: formatMessagesFromOpenAi(messages),
        });

        return completion.choices[0].message?.content || "Ответ не пришел";
    } catch (error: any) {
        console.error('Ошибка при обращении к OpenAi', `${error.code}: ${error.message}`);
        return error.message;
    }
}

/**
 * Отправляет запрос к Ollama API
 * @param history - Текст запроса или массив сообщений
 * @param userId - ID пользователя
 * @param model - Название модели
 * @returns - Ответ модели
 */

/**
 * Отправляет запрос к Ollama API
 */
async function askOllama(history: Message[] | string, userId: number, model: string): Promise<string> {
    try {
        const prompt = Array.isArray(history) ? formatHistory(history) : history;

        const response = await apiClient.post('/api/generate', {
            model,
            prompt,
            stream: false
        }, {
            headers: {
                'Content-Type': 'application/json',
                // 'Host': 'ollama-new' // Если нужно указать хост в заголовке
            }
        });

        return response.data.response;
    } catch (error) {
        console.error('Ошибка при обращении к Ollama:', error);
        return config.ERROR_MODEL_MESSAGE;
    }
}

/**
 * Отправляет запрос к Llamacpp API
 * @param history - Текст запроса или массив сообщений
 * @param userId - ID пользователя
 * @param model - Название модели
 * @returns - Ответ модели
 */
async function askLlamacpp(history: Message[] | string, userId: number, model: string): Promise<string> {
    try {
        // Если history - это массив сообщений, форматируем его
        const prompt = Array.isArray(history) ? formatHistoryLlamacpp(history) : history;
        const api_url = config.MODELS_CONFIG?.[model]?.api_url || config.MODEL_DEFAULT.api_url;

        const res = await fetch(api_url, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                n_predict: 128,
                stream: false,
                top_p: 0.7,
                temperature: 0.3,
                max_tokens: 50,
            })
        });

        const data = await res.json() as LlamacppResponse;
        return data.content;
    } catch (error) {
        console.error('Ошибка при обращении к Llamacpp:', error);
        return config.ERROR_MODEL_MESSAGE;
    }
}

/**
 * Отправляет запрос, определяет по модели какой метод модели взывать.
 * @param history - Текст запроса или массив сообщений
 * @param userId - ID пользователя
 * @param model - Название модели
 * @returns - Ответ модели
 */
async function askModelRoutre(userId: number, message: string, history: Message[], model: string): Promise<string> {
    try {
        if (config.OPEN_ROUTER_MODELS.includes(model)) {
            return await askOpenAi(history, userId, model);
        } else {
            return await askLlamacpp(history, userId, model);
        }
    } catch (error) {
        console.error('Ошибка при обращении', error);
        return config.ERROR_MODEL_MESSAGE;
    }
}

/**
 * Форматирует историю сообщений для отправки в модель Ollama
 * @param messages - Массив сообщений
 * @returns - Отформатированная история
 */
function formatHistory(messages: Message[]): string {
    return messages
        .map(m => {
            if (m.role === 'system') return `Инструкция: ${m.content}`;
            return (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content;
        })
        .join('\n') + '\nAssistant:';
}

/**
 * Форматирует историю сообщений для отправки в модель Llamacpp
 * @param messages - Массив сообщений
 * @returns - Отформатированная история
 */
function formatHistoryLlamacpp(messages: Message[]): string {
    return messages
        .map(m => {
            if (m.role === 'system') return `Инструкция: ${m.content}`;
            return (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content;
        })
        .join('\n') + '\nAssistant:';
}


export interface AIService {
    askModelRoutre: (userId: number, message: string, history: Message[], model: string) => Promise<string>;
    formatHistory: (history: Message[]) => string;
    formatHistoryLlamacpp: (history: Message[]) => string;
}

export const aiService: AIService = {
    askModelRoutre,
    formatHistory,
    formatHistoryLlamacpp
};