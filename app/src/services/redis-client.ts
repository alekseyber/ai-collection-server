// Модуль для работы с Redis
import { createClient } from 'redis';
import { Buffer } from 'buffer';
import { Message } from './ai-service/ai-provider.interface';

// Redis клиент
const redisClient = createClient({
  url: 'redis://redis:6379',
});

// Подключение к Redis
redisClient.connect().catch(console.error);

// Обработка ошибок Redis
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Функции для работы с конфигурацией
async function getConfig(key: string, defaultValue?: string): Promise<string | null> {
  try {
    const value = (await redisClient.get(`config:${key}`)) as string;
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

// Новая функция для получения переменных окружения с кешированием в Redis
async function getEnvConfig(key: string, defaultValue?: string): Promise<string> {
  try {
    // Пытаемся получить значение из Redis
    const redisValue: string | Buffer | null = await redisClient.get(`env:${key}`);

    if (redisValue !== null) {
      // Преобразуем Buffer в строку
      return Buffer.isBuffer(redisValue) ? redisValue.toString() : redisValue;
    }

    // Если в Redis нет, берем из process.env
    const envValue = process.env[key] || defaultValue;

    if (envValue) {
      // Сохраняем в Redis для будущих использований
      await redisClient.set(`env:${key}`, envValue);
      return envValue;
    }

    return defaultValue || '';
  } catch (error) {
    console.error(`Ошибка при работе с переменной окружения ${key}:`, error);
    return defaultValue || '';
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

// Возвращает выбранную модель или '' — вызывающая сторона подставляет дефолт из конфига.
// Раньше здесь был хардкод 'llama3', которого нет в MODELS_CONFIG: пользователь без
// выбора получал «Модель не найдена» вместо ответа.
async function getUserModel(userId: number): Promise<string> {
  try {
    const model = (await redisClient.get(`model:${userId}`)) as string;
    return model || '';
  } catch (error) {
    console.error('Ошибка загрузки модели пользователя:', error);
    return '';
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
    const history = (await redisClient.get(`history:${userId}`)) as string;
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

async function quitRedis(): Promise<void> {
  try {
    await redisClient.quit();
  } catch (error) {
    console.error('Ошибка при закрытии Redis:', error);
  }
}

export interface RedisClient {
  getConfig: (key: string, def?: string) => Promise<string | null>;
  setConfig: (key: string, value: string) => Promise<void>;
  getEnvConfig: (key: string, defaultValue?: string) => Promise<string>;
  getUserModel: (userId: number) => Promise<string>;
  setUserModel: (userId: number, model: string) => Promise<void>;
  saveUserHistory: (userId: number, history: Message[]) => Promise<void>;
  loadUserHistory: (userId: number) => Promise<Message[]>;
  clearUserHistory: (userId: number) => Promise<void>;
  quit: () => Promise<void>;
}

export const redisInstance: RedisClient = {
  getConfig,
  setConfig,
  getEnvConfig,
  setUserModel,
  getUserModel,
  saveUserHistory,
  loadUserHistory,
  clearUserHistory,
  quit: quitRedis,
};
