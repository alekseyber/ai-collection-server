import { Telegraf, Context } from 'telegraf';
import { loadConfig } from './config/config';
import type { LoadConfig } from './config/config';
import { redisInstance } from './redis-client';
import { AIService } from './ai-service';
import { AllowedService } from './allowed-service';
import { utils } from './utils/utils';
import { KinopoiskService } from './kinopoisk-api-service';

export let bot: Telegraf<Context>;

/**
 * Настраивает обработчики команд и сообщений бота
 */
function setupBotHandlers(config: LoadConfig, aiService: AIService, allowedService: AllowedService, kinopoiskService: KinopoiskService): void {
    let isKinopiskRating = false;

    // Обработчик сообщений
    bot.on('message', async (ctx, next) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;
        // Проверяем, является ли сообщение текстовым
        if (!('text' in ctx.message)) {
            return; // Игнорируем неподдерживаемые типы сообщений
        }

        const userMessageText = ctx.message?.text;

        if (!chatId || !userId || !userMessageText) return;

        console.log(`Получено сообщение от ${userId}: ${userMessageText}`);

        // Список команд, которые не должны попадать в историю
        const serviceCommands = [
            '/setmodel',
            '/getmodel',
            '/modelmenu',
            '/setprompt',
            '/getprompt',
            '/setstartmsg',
            '/getstartmsg',
            '/clear',
            '/start',
            '/getavpkinorating'];
        if (serviceCommands.some(cmd => userMessageText.startsWith(cmd))) {
            next();
            return;
        }

        if (isKinopiskRating && isNaN(Number(userMessageText))) {
            await ctx.reply('Введите номер страницы');
            next();
            return;
        }

        if (isKinopiskRating) {
            await ctx.sendChatAction('typing');
            const page = Number(userMessageText);
            const response = await kinopoiskService.getAvpMoviesReating(page);

            // Отправляем ответ пользователю
            const { info, csvContent } = utils.formatingKinopiskRating(response, page)
            await ctx.reply(info);

            if (csvContent) {
                // Отправляем как файл
                await ctx.replyWithDocument(
                    { source: Buffer.from(csvContent, 'utf8'), filename: `ratings_page_${page}.csv` },
                    {
                        caption: '📊 Рейтинг фильмов AVP (CSV)',
                    }
                );
            }

            next();
            return;
        }

        // Загружаем историю пользователя
        let history = await redisInstance.loadUserHistory(userId);

        // Если история пустая, добавляем системную инструкцию
        if (history.length === 0) {
            history = [
                { role: 'system', content: config.startPrompt }
            ];
        }

        // Добавляем сообщение пользователя в историю
        history.push({ role: 'user', content: userMessageText });

        // Получаем выбранную модель
        const model = await redisInstance.getUserModel(userId);

        // Отправляем "печатает..." статус
        await ctx.sendChatAction('typing');

        try {
            // Получаем ответ от модели
            const response = await aiService.askModelRoute(userId, userMessageText, history, model);

            if (response !== config.ERROR_MODEL_MESSAGE) {
                // Добавляем ответ модели в историю
                history.push({ role: 'assistant', content: utils.formatingResponseAiContent(response) });

                // Сохраняем обновленную историю
                await redisInstance.saveUserHistory(userId, history);
            }

            // Отправляем ответ пользователю
            await ctx.reply(response, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: false }
            });

        } catch (error: any) {
            console.error('Ошибка:', error.message);
            await ctx.reply('Произошла ошибка при обработке сообщения.');
        }
    });

    // Команда /start
    bot.hears(/\/start/, async (ctx) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!chatId || !userId) return;

        try {
            // Очищаем историю при старте
            await redisInstance.clearUserHistory(userId);
            isKinopiskRating = false;

            await ctx.reply(config.startMessage);
        } catch (error) {
            console.error('Ошибка:', error);
            await ctx.reply('Произошла ошибка при обработке команды.');
        }
    });

    // Команда /clear для очистки истории
    bot.hears(/\/clear/, async (ctx) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!chatId || !userId) return;

        await redisInstance.clearUserHistory(userId);
        await ctx.reply('История диалога очищена!');
    });

    // Команда /setprompt для изменения системного промпта (только для админов)
    bot.hears(/\/setprompt (.+)/, async (ctx, next) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;
        const newPrompt = ctx.match?.[1] || '';

        if (!chatId || !userId) return;

        // Здесь можно добавить проверку на админа
        if (!allowedService.getAdminPermission(userId)) {
            await ctx.reply('У вас нет прав для изменения промпта.');
            return;
        }

        await redisInstance.setConfig('start_prompt', newPrompt);
        // Обновляем промпт в конфигурации
        config.startPrompt = newPrompt;
        await ctx.reply('Системный промпт обновлен!');
    });

    // Команда /getavpkinorating просмотр рейтинга фильмов AVP
    bot.hears(/\/getavpkinorating/, async (ctx, next) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!chatId || !userId) return;

        // Здесь можно добавить проверку супер пользователя
        if (!allowedService.getSuperUserPermission(userId)) {
            await ctx.reply('У вас нет прав на выполнение этого действия.');
            return;
        }
        isKinopiskRating = true;
        await ctx.reply("Введите номер страницы");
    });

    // Команда /getprompt для просмотра текущего промпта
    bot.hears(/\/getprompt/, async (ctx) => {
        const chatId = ctx.chat?.id;
        if (!chatId) return;

        await ctx.reply(`Текущий системный промпт:\n${config.startPrompt}`);
    });

    // Команда /setstartmsg для изменения стартового сообщения (только для админов)
    bot.hears(/\/setstartmsg (.+)/, async (ctx) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!chatId || !userId) return;

        try {
            if (!allowedService.getAdminPermission(userId)) {
                await ctx.reply('У вас нет прав для изменения стартового сообщения.');
                return;
            }
            const newMsg = ctx.match?.[1] || '';
            await redisInstance.setConfig('start_message', newMsg);
            // Обновляем стартовое сообщение в конфигурации
            config.startMessage = newMsg;
            await ctx.reply('Стартовое сообщение обновлено!');
        } catch (error) {
            console.error('Ошибка:', error);
            await ctx.reply('Произошла ошибка при обработке команды.');
        }
    });

    // Команда /getstartmsg для просмотра текущего стартового сообщения
    bot.hears(/\/getstartmsg/, async (ctx) => {
        const chatId = ctx.chat?.id;
        if (!chatId) return;

        await ctx.reply(`Текущее стартовое сообщение:\n${config.startMessage}`);
    });

    // Команда /setmodel <model>
    bot.hears(/\/setmodel (.+)/, async (ctx) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;
        const model = ctx.match?.[1]?.trim() || '';

        if (!chatId || !userId) return;

        if (!allowedService.getModelPermissionStatus(userId, model)) {
            await ctx.reply(`Модель ${model} не поддерживается. Доступные: ${allowedService.getAllowedModelsLabels(userId)}`);
            return;
        }

        await redisInstance.setUserModel(userId, model);
        await ctx.reply(`Модель успешно изменена на ${allowedService.getAllowedModelsLabels(userId)}`);
    });

    // Команда /getmodel
    bot.hears(/\/getmodel/, async (ctx) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!chatId || !userId) return;

        const model = await redisInstance.getUserModel(userId);
        await ctx.reply(`Текущая модель: ${config.MODELS_CONFIG[model]?.text}`);
    });

    // Команда /modelmenu для выбора модели через меню
    bot.hears(/\/modelmenu/, async (ctx) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;
        if (!chatId || !userId) return;

        try {
            const { modelList } = allowedService.getModelList(userId);

            const inline_keyboard = modelList.map(({ text, key }) => [{
                text,
                callback_data: `setmodel_${key}`
            }]);

            const keyboard = {
                reply_markup: {
                    inline_keyboard,
                }
            };

            try {
                await ctx.reply('Выберите модель:', keyboard);
            } catch (error: any) {
                console.error('Ошибка при отправке меню моделей:', error.message);
            }
        } catch (error: any) {
            console.error('Ошибка при обработке /modelmenu:', error.message);
            try {
                await ctx.reply("Ошибка при выполнении команды");
            } catch (e) {
                console.error('Не удалось отправить сообщение об ошибке:', e);
            }
        }
    });

    // Обработчик callback-запросов
    bot.on('callback_query', async (ctx) => {
        const query = ctx.callbackQuery;
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!('data' in query)) {
            await ctx.answerCbQuery();
            return;
        }

        const queryData = query.data;

        if (!chatId || !userId || !queryData) {
            await ctx.answerCbQuery();
            return;
        }

        try {
            const cleanedData = queryData.replace(/setmodel_/ig, "");
            const selectedModel = allowedService.getModelPermissionSelected(userId, cleanedData);

            if (!selectedModel) {
                await ctx.reply("Доступ запрещён");
                await ctx.answerCbQuery('Доступ запрещён', { show_alert: true });
                return;
            }

            await redisInstance.setUserModel(userId, selectedModel.key);
            await ctx.reply(`Модель изменена на ${selectedModel.text}`);
            await ctx.answerCbQuery();
        } catch (error: any) {
            console.error('Ошибка в callback_query:', error);

            const isExpired = error.message.includes('query is too old') ||
                error.message.includes('response timeout expired');

            if (isExpired) {
                console.warn('Callback_query устарел, пропускаем обработку');
                return;
            }

            try {
                await ctx.answerCbQuery('Произошла ошибка', { show_alert: true });
            } catch (innerError: any) {
                console.error('Не удалось отправить сообщение об ошибке:', innerError.message);
            }
        }
    });
}

/**
 * Инициализирует бота с токеном и настраивает обработчики
 * @returns - Экземпляр бота
 */
export async function initializeBot(): Promise<Telegraf<Context>> {
    try {
        const config = await loadConfig();
        const token = await redisInstance.getConfig('telegram_token', config.DEFAULT_TOKEN_TELEGRAM) || '';
        if (!token) {
            throw new Error('Не найден токен Telegram');
        }

        bot = new Telegraf(token);
        console.log('Telegram бот инициализирован');

        const aiServiceInstance = new AIService(config);
        const allowedService = new AllowedService(config);
        const kinopoiskService = new KinopoiskService(config);
        setupBotHandlers(config, aiServiceInstance, allowedService, kinopoiskService);

        await bot.launch();
        return bot;
    } catch (error) {
        console.error('Ошибка инициализации бота:', error);
        throw error;
    }
}
