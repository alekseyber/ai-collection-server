// Модуль для работы с Redis
import { createClient } from 'redis';
import { Message } from './ai-service';

// Redis клиент
const redisClient = createClient({
    url: 'redis://redis:6379'
});

// Подключение к Redis
redisClient.connect().catch(console.error);

// Обработка ошибок Redis
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Функции для работы с конфигурацией
async function getConfig(key: string, defaultValue?: string): Promise<string | null> {
    try {
        const value = await redisClient.get(`config:${key}`) as string;
        return value || defaultValue || null;
    } catch (error) {
        console.error(`Ошибка загрузки конфигурации ${key}:`, error);
        return defaultValue || null;
    }
}

async function setConfig(key: string, value: string): Promise<void> {
    try {
        await redisClient.set(`config:${key}`, value);
        console.log(`Конфигурация ${key} обновлена`);
    } catch (error) {
        console.error(`Ошибка сохранения конфигурации ${key}:`, error);
    }
}

// Функции для работы с моделью пользователя
async function setUserModel(userId: number, model: string): Promise<void> {
    try {
        await redisClient.set(`model:${userId}`, model);
    } catch (error) {
        console.error('Ошибка сохранения модели пользователя:', error);
    }
}

async function getUserModel(userId: number): Promise<string> {
    try {
        const model = await redisClient.get(`model:${userId}`) as string;
        return model || 'llama3'; // По умолчанию llama3
    } catch (error) {
        console.error('Ошибка загрузки модели пользователя:', error);
        return 'llama3';
    }
}

// Функции для работы с историей
async function saveUserHistory(userId: number, history: Message[]): Promise<void> {
    try {
        await redisClient.set(`history:${userId}`, JSON.stringify(history));
    } catch (error) {
        console.error('Ошибка сохранения истории:', error);
    }
}

async function loadUserHistory(userId: number): Promise<Message[]> {
    try {
        const history = await redisClient.get(`history:${userId}`) as string;
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        return [];
    }
}

async function clearUserHistory(userId: number): Promise<void> {
    try {
        await redisClient.del(`history:${userId}`);
    } catch (error) {
        console.error('Ошибка очистки истории:', error);
    }
}

export interface RedisClient {
    getConfig: (key: string, def?: string) => Promise<string | null>;
    setConfig: (key: string, value: string) => Promise<void>;
    getUserModel: (userId: number) => Promise<string>;
    setUserModel: (userId: number, model: string) => Promise<void>;
    saveUserHistory: (userId: number, history: Message[]) => Promise<void>;
    loadUserHistory: (userId: number) => Promise<Message[]>;
    clearUserHistory: (userId: number) => Promise<void>;
}

export const redisInstance: RedisClient = {
    getConfig,
    setConfig,
    setUserModel,
    getUserModel,
    saveUserHistory,
    loadUserHistory,
    clearUserHistory
}