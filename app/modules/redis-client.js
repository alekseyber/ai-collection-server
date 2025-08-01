// Модуль для работы с Redis
import { createClient } from 'redis';

// Redis клиент
const redisClient = createClient({
    url: 'redis://redis:6379'
});

// Подключение к Redis
redisClient.connect().catch(console.error);

// Обработка ошибок Redis
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Функции для работы с конфигурацией
async function getConfig(key, defaultValue) {
    try {
        const value = await redisClient.get(`config:${key}`);
        return value || defaultValue;
    } catch (error) {
        console.error(`Ошибка загрузки конфигурации ${key}:`, error);
        return defaultValue;
    }
}

async function setConfig(key, value) {
    try {
        await redisClient.set(`config:${key}`, value);
        console.log(`Конфигурация ${key} обновлена`);
    } catch (error) {
        console.error(`Ошибка сохранения конфигурации ${key}:`, error);
    }
}

// Функции для работы с моделью пользователя
async function setUserModel(userId, model) {
    try {
        await redisClient.set(`model:${userId}`, model);
    } catch (error) {
        console.error('Ошибка сохранения модели пользователя:', error);
    }
}

async function getUserModel(userId) {
    try {
        const model = await redisClient.get(`model:${userId}`);
        return model || 'llama3'; // По умолчанию llama3
    } catch (error) {
        console.error('Ошибка загрузки модели пользователя:', error);
        return 'llama3';
    }
}

// Функции для работы с историей
async function saveHistory(userId, history) {
    try {
        await redisClient.set(`history:${userId}`, JSON.stringify(history));
    } catch (error) {
        console.error('Ошибка сохранения истории:', error);
    }
}

async function loadHistory(userId) {
    try {
        const history = await redisClient.get(`history:${userId}`);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        return [];
    }
}

async function clearHistory(userId) {
    try {
        await redisClient.del(`history:${userId}`);
    } catch (error) {
        console.error('Ошибка очистки истории:', error);
    }
}

export const redisInstance = {
    getConfig,
    setConfig,
    setUserModel,
    getUserModel,
    saveHistory,
    loadHistory,
    clearHistory
}

