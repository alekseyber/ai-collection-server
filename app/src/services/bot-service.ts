import { Context, Telegraf } from 'telegraf';
import { redisInstance } from './redis-client';
import { AIService } from './ai-service/ai-service';
import { AllowedService } from './allowed-service';
import { KinopoiskService } from './kinopoisk-api-service';
import { loadConfig } from './config/config';
import { setupBotHandlers } from './bot-handlers/setup-bot-handlers';
import { ErrorTelegram } from './errors/error-telegram.class';


export let bot: Telegraf<any>;

/**
 * Инициализирует бота с токеном и настраивает обработчики
 * @returns - Экземпляр бота
 */

export async function initializeBot(): Promise<Telegraf<Context>> {
    try {
        const config = await loadConfig();
        const token = await redisInstance.getConfig('telegram_token', config.DEFAULT_TOKEN_TELEGRAM);
        if (!token) throw new Error('Не найден токен Telegram');

        bot = new Telegraf(token);
        console.log('Telegram бот инициализирован');

        const aiService = new AIService(config);
        const allowedService = new AllowedService(config);
        const kinopoiskService = new KinopoiskService(config);

        setupBotHandlers(bot, config, aiService, allowedService, kinopoiskService);

        await bot.launch();
        return bot;
    } catch (error) {
        console.log({error})
        
        new ErrorTelegram('Ошибка инициализации бота', error);
        throw error;
    }
}