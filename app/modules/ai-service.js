import OpenAI from 'openai';
import { config } from "./config/config.js"
//import {allowedService} from './allowed-service.js';

// Модуль для работы с AI моделями
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// // https://api-docs.deepseek.com/
// const openai = new OpenAI({
//     baseURL: 'https://api.deepseek.com',
//     apiKey: config.DEEPSEEK_API_KEY,
// });

//https://openrouter.ai/z-ai/glm-4.5-air:free/api
const clientOpenRuter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.OPEN_AI_API_KEY,
});


/**
 * Отправляет запрос к OpenAI
 * @param {string} prompt - Текст запроса или массив сообщений
 * @param {string} userId - ID пользователя
 * @param {string} model - Название модели
 * @returns {Promise<string>} - Ответ модели
 */
async function askOpenAi(messages, userId, modelKey = config.MODELS_CONFIG.glm_4_5_air.key_api) {
    try {
        const model = config.MODELS_CONFIG[modelKey].key_api || config.MODELS_CONFIG.glm_4_5_air.key_api;

        const completion = await clientOpenRuter.chat.completions.create({
            model,
            messages,
        });

        return completion.choices[0].message?.content || "Ответ не пришел";
    } catch (error) {
        console.error('Ошибка при обращении к OpenAi', `${error.code}: ${error.message}`);
        return error.message;
    }
}

/**
 * Отправляет запрос к Ollama API
 * @param {string} prompt - Текст запроса
 * @param {string} userId - ID пользователя
 * @param {string} model - Название модели
 * @returns {Promise<string>} - Ответ модели
 */
async function askOllama(history, userId, model) {
    try {
        const prompt = Array.isArray(history) ? formatHistory(history) : history;
        const res = await fetch('http://ollama-new:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false
            })
        });

        const data = await res.json();
        return data.response;
    } catch (error) {
        console.error('Ошибка при обращении к Ollama:', error);
        return config.ERROR_MODEL_MESSAGE;
    }
}

/**
 * Отправляет запрос к Llamacpp API
 * @param {string} prompt - Текст запроса или массив сообщений
 * @param {string} userId - ID пользователя
 * @param {string} model - Название модели
 * @returns {Promise<string>} - Ответ модели
 */
async function askLlamacpp(history, userId, model) {
    try {
        // Если prompt - это массив сообщений, форматируем его
        const prompt = Array.isArray(history) ? formatHistoryLlamacpp(history) : history;
        const api_url = config.MODELS_CONFIG?.[model]?.api_url || config.MODEL_DEFAULT.api_url;

        const res = await fetch(api_url, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                n_predict: 64,
                stream: false
            })
        });

        const data = await res.json();
        //  console.log({ 'res.cont:': data.content, formattedPrompt });
        return data.content;
    } catch (error) {
        console.error('Ошибка при обращении к Llamacpp:', error);
        return config.ERROR_MODEL_MESSAGE;
    }
}

/**
 * Отправляет запрос, определяет по модели какой метод модели взывать.
 * @param {string} prompt - Текст запроса или массив сообщений
 * @param {string} userId - ID пользователя
 * @param {string} model - Название модели
 * @returns {Promise<string>} - Ответ модели
 */
async function askModelRoutre(history, userId, model) {
    try {

        // if (!allowedService.getAllowedByUserId(userId, config.MODELS_CONFIG.glm_4_5_air.key)) {
        //     return "Использование этой модели ограничено для данного пользователя";
        // }
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
 * @param {Array} messages - Массив сообщений
 * @returns {string} - Отформатированная история
 */
function formatHistory(messages) {
    return messages
        .map(m => {
            if (m.role === 'system') return `Инструкция: ${m.content}`;
            return (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content;
        })
        .join('\n') + '\nAssistant:';
}

/**
 * Форматирует историю сообщений для отправки в модель Llamacpp
 * @param {Array} messages - Массив сообщений
 * @returns {string} - Отформатированная история
 */
function formatHistoryLlamacpp(messages) {
    return messages
        .map(m => {
            if (m.role === 'system') return `Инструкция: ${m.content}`;
            return (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content;
        })
        .join('\n') + '\nAssistant:';
}

export const aiService = {
    askModelRoutre,
    formatHistory,
    formatHistoryLlamacpp
}