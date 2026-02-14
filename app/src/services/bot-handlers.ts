import { Telegraf, Context } from 'telegraf';
import { loadConfig } from './config/config';
import type { LoadConfig } from './config/config';
import { redisInstance } from './redis-client';
import { AIService } from './ai-service';
import { AllowedService } from './allowed-service';
import { utils } from './utils/utils';
import { KinopoiskService } from './kinopoisk-api-service';
import { EmbeddingService } from './embedding-service';
import { ErrorApp } from './errors/error-app.class';
import { ErrorTelegram } from './errors/error-telegram.class';
import { convert } from 'telegram-markdown-v2';

export let bot: Telegraf<Context>;

/**
 * Настраивает обработчики команд и сообщений бота
 */
function setupBotHandlers(config: LoadConfig, aiService: AIService, allowedService: AllowedService, kinopoiskService: KinopoiskService, embeddingService: EmbeddingService): void {
    const isKinopiskRating: Record<string, boolean> = {};
    const isEmbeddingsMode: Record<string, boolean> = {};

    const clearModesCurrentUser = (userId: number) => {
        isKinopiskRating[String(userId)] = false;
        isEmbeddingsMode[String(userId)] = false;
    };

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
            '/setmodel', // Выбрать модель
            '/getmodel', // Получить текущую модель
            '/modelmenu', // Меню моделей
            '/setprompt', // Задать стартовый промпт
            '/getprompt', // Получить тестовый промт
            '/setstartmsg', // Задать привественное сообщение
            '/getstartmsg', // Получить привественное сообщение
            '/clear', // Очистить историю
            '/start', // Начать диалог
            '/getavpkinorating', // Получить рейтинг фильмов AVP
            '/on_embeddings', // Включить режим embeddings
        ];
        if (serviceCommands.some(cmd => userMessageText.startsWith(cmd))) {
            next();
            return;
        }

        if (isEmbeddingsMode[String(userId)] && !userMessageText) {
            await ctx.reply('Введите текст, вы в режиме embeddings');
            next();
            return;
        }

        if (isEmbeddingsMode[String(userId)]) {
            await ctx.reply("Ожидайте, запрос отправлен");
            await embeddingService.addEmbeddingSource(userMessageText); // searchSimilar addEmbeddingSource

            await ctx.reply('Ответ модели получен, введите следующий текст');
            next();
            return;
        }

        if (isKinopiskRating[String(userId)] && isNaN(Number(userMessageText))) {
            await ctx.reply('Введите номер страницы');
            next();
            return;
        }

        if (isKinopiskRating[String(userId)]) {
            await ctx.sendChatAction('typing');
            const page = Number(userMessageText);
            try {
                if (page < 1000) {
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
                } else {
                    await ctx.reply("Ожидайте, запросы отправляются");
                    const items = await kinopoiskService.getAvpMoviesReatinAllPages();
                    const itemsCsv = utils.getCsvKinopiskRating(items);
                    // Отправляем как файл
                    await ctx.replyWithDocument(
                        { source: Buffer.from(itemsCsv, 'utf8'), filename: "ratings_page_all.csv" },
                        {
                            caption: '📊 Рейтинг фильмов AVP (CSV)',
                        }
                    );
                }

            } catch (error: any) {
                new ErrorTelegram('Error fetching movies KinopiskRating', error, ctx);
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

        let responseModel: string

        try {
            // Получаем ответ от модели
            responseModel = await aiService.askModelRoute(userId, userMessageText, history, model);

            if (responseModel !== config.ERROR_MODEL_MESSAGE) {
                // Добавляем ответ модели в историю
                history.push({ role: 'assistant', content: utils.formatingResponseAiContent(responseModel) });

                // Сохраняем обновленную историю
                await redisInstance.saveUserHistory(userId, history);
            }

            // Отправляем ответ пользователю
            await ctx.reply(responseModel, {
                parse_mode: 'MarkdownV2',
                link_preview_options: { is_disabled: false }
            });

        } catch (error: any) {
            const err = new ErrorTelegram('Произошла ошибка при обработке ответа сообщения', error, ctx);
            if (err.errorCode == "400" && responseModel) {
                try {
                    await ctx.reply(convert(responseModel, "remove"), {
                        parse_mode: 'MarkdownV2',
                        link_preview_options: { is_disabled: false }
                    });
                } catch (e: any) {
                    new ErrorTelegram('Произошла повторная ошибка после convert при обработке ответа сообщения', e, ctx);
                }
            }
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
            clearModesCurrentUser(userId);

            await ctx.reply(config.startMessage);
        } catch (error) {
            new ErrorTelegram('Произошла ошибка при обработке команды /start', error, ctx);
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
        clearModesCurrentUser(userId);
        isKinopiskRating[String(userId)] = true;
        await ctx.reply("Введите номер страницы");
    });

    // Команда /on_embeddings просмотр рейтинга фильмов AVP
    bot.hears(/\/on_embeddings/, async (ctx, next) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;

        if (!chatId || !userId) return;

        // Здесь можно добавить проверку супер пользователя
        if (!allowedService.getSuperUserPermission(userId)) {
            await ctx.reply('У вас нет прав на выполнение этого действия.');
            return;
        }
        clearModesCurrentUser(userId);
        isEmbeddingsMode[String(userId)] = true;
        await ctx.reply("Вы в режиеме embeddings");
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
            new ErrorTelegram('Произошла ошибка при обработке команды /setstartmsg', error, ctx);
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
                new ErrorTelegram('Ошибка при отправке меню моделей', error);
            }
        } catch (error: any) {
            new ErrorTelegram('Ошибка при обработке /modelmenu:', error, ctx);
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
            const isExpired = error.message.includes('query is too old') ||
                error.message.includes('response timeout expired');

            if (isExpired) {
                new ErrorTelegram('allback_query устарел, пропускаем обработку', error);
                return;
            }
            new ErrorTelegram('Ошибка в callback_query', error);

            try {
                await ctx.answerCbQuery('Произошла ошибка', { show_alert: true });
            } catch (innerError: any) {
                new ErrorTelegram('Не удалось отправить answerCbQuery сообщение об ошибке', innerError);
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
            throw new ErrorApp('Не найден токен Telegram');
        }

        bot = new Telegraf(token);
        console.log('Telegram бот инициализирован');

        const aiServiceInstance = new AIService(config);
        const allowedService = new AllowedService(config);
        const kinopoiskService = new KinopoiskService(config);
        const embeddingService = new EmbeddingService(config, aiServiceInstance)
        setupBotHandlers(config, aiServiceInstance, allowedService, kinopoiskService, embeddingService);

        await bot.launch();
        return bot;
    } catch (error) {
        new ErrorTelegram('Ошибка инициализации бота:', error);
    }
}
